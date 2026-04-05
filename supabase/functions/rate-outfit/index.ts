import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getApiKey(): string {
  const keys = [
    Deno.env.get("GOOGLE_AI_API_KEY"),
    Deno.env.get("GOOGLE_AI_API_KEY_2"),
    Deno.env.get("GOOGLE_AI_API_KEY_3"),
    Deno.env.get("GOOGLE_AI_API_KEY_4"),
  ].filter(Boolean) as string[];
  if (keys.length === 0) throw new Error("No GOOGLE_AI_API_KEY configured");
  return keys[Math.floor(Math.random() * keys.length)];
}

async function callGemini(apiKey: string, messages: any[], temperature: number, maxTokens: number, model: string = "gemini-2.5-flash-lite") {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  });
  if (res.status === 429) throw { status: 429, message: "Rate limited, please try again later.", stage: "gemini_call" };
  if (res.status === 402) throw { status: 402, message: "AI credits exhausted.", stage: "gemini_call" };
  if (!res.ok) {
    const t = await res.text();
    console.error(`Gemini error [${res.status}] model=${model}:`, t.substring(0, 500));
    if (t.includes("SAFETY") || t.includes("blocked") || t.includes("HarmCategory")) {
      throw { status: res.status, message: "Content blocked by safety filter", stage: "safety_block", model };
    }
    throw { status: res.status, message: `Gemini ${res.status}: ${t.substring(0, 200)}`, stage: "provider_error", model };
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  const finishReason = data.choices?.[0]?.finish_reason || "unknown";
  console.log(`Gemini raw (model=${model}, finish=${finishReason}):`, content.substring(0, 300));
  if (!content.trim()) {
    throw { status: 200, message: "Empty response from AI", stage: "empty_response", model, finish_reason: finishReason };
  }
  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch {}
    }
    console.error("JSON parse failed:", cleaned.substring(0, 500));
    throw { status: 200, message: "Failed to parse AI response as JSON", stage: "json_parse", model };
  }
}

// ===== PRE-BUILT COPY BANK (248 AI-generated entries) =====
const COPY_BANK: Record<string, Array<{killer_tag: string; praise_line: string}>> = {"standard_solo_male_low": [{"killer_tag": "Lost A Bet? \ud83e\udd28", "praise_line": "You're telling me you chose to wear this willingly"}, {"killer_tag": "NPC Fit Check \ud83d\udeb6\u200d\u2642\ufe0f", "praise_line": "Blink twice if your mom still dresses you"}, {"killer_tag": "This Ain't It Chief \ud83e\udee1", "praise_line": "The confidence is loud but the outfit is on mute"}, {"killer_tag": "My Eyes Are Burning \ud83d\udd25", "praise_line": "This is what happens when you let the algorithm style you"}, {"killer_tag": "Delete This Immediately \ud83d\uddd1\ufe0f", "praise_line": "Did you get dressed in the dark during an earthquake"}, {"killer_tag": "The Audacity Is Real \ud83d\ude2d", "praise_line": "Not every thought needs to become an outfit, my guy"}, {"killer_tag": "Bro What Happened \ud83d\udc80", "praise_line": "You look like a randomly generated video game character"}, {"killer_tag": "Seek Professional Help \ud83d\ude4f", "praise_line": "I'm not mad, I'm just aggressively disappointed for you"}], "standard_solo_male_mid": [{"killer_tag": "Almost Had It \ud83e\udd0f", "praise_line": "You were one accessory away from not being boring"}, {"killer_tag": "Tried Your Best \u2728", "praise_line": "It's giving 'I read one fashion article once'"}, {"killer_tag": "Okay Mr. Safe Choice \ud83e\udd71", "praise_line": "Congrats on looking exactly like every other guy"}, {"killer_tag": "It's A Vibe I Guess \ud83e\udd37\u200d\u2642\ufe0f", "praise_line": "You didn't fail but you definitely didn't pass with honors"}, {"killer_tag": "The Potential Is There \ud83d\udd2d", "praise_line": "This is the 'before' picture in a glow-up montage"}, {"killer_tag": "Decent But Forgettable \ud83d\udca8", "praise_line": "I like it, but I won't remember this tomorrow"}, {"killer_tag": "Solid 6/10 Energy \ud83d\ude10", "praise_line": "You look nice enough for your aunt to give you $20"}, {"killer_tag": "You Followed The Rules \u2705", "praise_line": "This outfit is the human equivalent of vanilla ice cream"}], "standard_solo_male_high": [{"killer_tag": "Okay Go Off Then \ud83d\udc4f", "praise_line": "Who let you cook because they need a promotion"}, {"killer_tag": "Main Character Incoming \u2728", "praise_line": "Alright, we see the vision and we respect the vision"}, {"killer_tag": "He Didn't Come To Play \ud83d\ude24", "praise_line": "Suddenly I need to re-evaluate my entire closet"}, {"killer_tag": "The Fit Is Fitting \ud83d\udcaf", "praise_line": "You look like you know where the best afterparty is"}, {"killer_tag": "Saving This To My Board \ud83d\udccc", "praise_line": "This is my new personality for the next business week"}, {"killer_tag": "Aura On Full Display \ud83d\ude2e\u200d\ud83d\udca8", "praise_line": "My guy woke up and chose curated excellence"}, {"killer_tag": "Understood The Assignment \u270d\ufe0f", "praise_line": "You styled this better than the person who designed it"}, {"killer_tag": "Serving Effortless Cool \ud83d\ude0e", "praise_line": "Is it exhausting knowing you look this good"}], "standard_solo_male_elite": [{"killer_tag": "This Is Art Sir \ud83d\uddbc\ufe0f", "praise_line": "You didn't just get dressed, you built a monument"}, {"killer_tag": "Bow Down To The King \ud83d\udc51", "praise_line": "This fit just paid my rent and cleared my skin"}, {"killer_tag": "A God Is Walking \u26a1\ufe0f", "praise_line": "They need to archive this outfit in a museum"}, {"killer_tag": "THE VIBE IS VIOLENT \ud83d\udca5", "praise_line": "This isn't an outfit, it's a cultural reset"}, {"killer_tag": "Okay Final Boss \ud83d\udc79", "praise_line": "You're the reason they invent new words for 'cool'"}, {"killer_tag": "My Brain Is Broken \ud83e\udd2f", "praise_line": "Did it hurt when you fell from fashion heaven"}, {"killer_tag": "Rent PAID In Full \ud83d\udcb0", "praise_line": "This look just solved half of my life's problems"}, {"killer_tag": "Human Cheat Code \ud83c\udfae", "praise_line": "Some people get dressed and some people ascend like this"}], "standard_solo_female_low": [{"killer_tag": "It's A No From Me \ud83d\ude45\u200d\u2640\ufe0f", "praise_line": "Your group chat let you leave the house like this"}, {"killer_tag": "This Is A Cry For Help \ud83c\udd98", "praise_line": "Bestie, the only thing this is serving is consequences"}, {"killer_tag": "Girl What Is THIS \ud83e\udd28", "praise_line": "You must have lost a fight with a clearance rack"}, {"killer_tag": "I'm Actually Speechless \ud83d\ude36", "praise_line": "This outfit just called me ugly and stole my lunch money"}, {"killer_tag": "Justice For This Body \u2696\ufe0f", "praise_line": "That outfit is a crime against you and humanity"}, {"killer_tag": "Return It All Immediately \u23ea", "praise_line": "Did Pinterest hurt you in some way"}, {"killer_tag": "Make It Make Sense \ud83d\ude2d", "praise_line": "Even the fabric looks embarrassed to be worn like this"}, {"killer_tag": "Log Off For Me Sweetie \ud83d\udd0c", "praise_line": "The confidence to post this is what I truly need"}], "standard_solo_female_mid": [{"killer_tag": "Cute But Make It Basic \u2728", "praise_line": "This is the perfect outfit for doing nothing special"}, {"killer_tag": "We've Seen It Before \ud83e\udd71", "praise_line": "It's giving 'I need to be somewhere in 15 minutes'"}, {"killer_tag": "It's Definitely An Outfit \ud83d\udc4d", "praise_line": "You look nice, if 'nice' is all you were going for"}, {"killer_tag": "So Close Yet So Far \ud83e\udd0f", "praise_line": "She's got the spirit, just not the killer instinct"}, {"killer_tag": "Bless Her Heart \ud83d\ude4f", "praise_line": "This is what my mom would probably call 'put together'"}, {"killer_tag": "Okay Influencer-In-Training \ud83e\udd33", "praise_line": "You copied someone's homework but changed it slightly"}, {"killer_tag": "Not Mad At It \ud83e\udd37\u200d\u2640\ufe0f", "praise_line": "It\u2019s a perfectly acceptable fit for a trip to Target"}, {"killer_tag": "Give Us A Little More \ud83c\udf36\ufe0f", "praise_line": "You're on the right track but the train is moving slow"}], "standard_solo_female_high": [{"killer_tag": "Ate And Left No Crumbs \ud83c\udf7d\ufe0f", "praise_line": "I'm taking notes and I'm not even sorry about it"}, {"killer_tag": "The Effortless Slay \ud83d\udc85", "praise_line": "You just know she smells expensive and unbothered"}, {"killer_tag": "Okay Main Character Energy \ud83c\udfac", "praise_line": "This is the fit you wear to casually run into your ex"}, {"killer_tag": "The Girls Are Fighting \ud83e\udd4a", "praise_line": "This outfit just made someone, somewhere, irrationally angry"}, {"killer_tag": "It's The \u2728Vibe\u2728 For Me \ud83d\ude2e\u200d\ud83d\udca8", "praise_line": "How does it feel to be God's absolute favorite"}, {"killer_tag": "Obsessed Is An Understatement \ud83d\ude33", "praise_line": "My bank account is scared of how much this inspires me"}, {"killer_tag": "Put This On A Board \ud83d\udccc", "praise_line": "You woke up and chose to remind us we're broke"}, {"killer_tag": "Let Them All Stare \ud83d\udc40", "praise_line": "This is what they mean by 'dress for the life you want'"}], "standard_solo_female_elite": [{"killer_tag": "A Walking Work Of Art \ud83c\udfdb\ufe0f", "praise_line": "I would simply let you ruin my life in this outfit"}, {"killer_tag": "This Should Be Illegal \ud83d\udd25", "praise_line": "You should have to pay a luxury tax for looking this good"}, {"killer_tag": "Mother Is Mothering \ud83d\udc51", "praise_line": "Respectfully, I am on my knees right now"}, {"killer_tag": "Stepping On Our Necks \ud83d\udc60", "praise_line": "This outfit is a threat and I feel very threatened"}, {"killer_tag": "A Literal Goddess \uc22d", "praise_line": "Forget a snack, you're the whole Michelin star restaurant"}, {"killer_tag": "The Final Boss Arrived \ud83d\udc0d", "praise_line": "This look could start a war or end one with a glance"}, {"killer_tag": "Jaw Is On The Floor \ud83e\udee8", "praise_line": "Are you even real or are you a divine prophecy"}, {"killer_tag": "So Dangerous, So Chic \ud83d\udd2a", "praise_line": "This kind of power can't be bought, it has to be earned"}], "savage_solo_male_low": [{"killer_tag": "AI Generated Outfit \ud83e\udd16", "praise_line": "Did ChatGPT dress you in the dark bro"}, {"killer_tag": "Bro is NOT cooking \ud83c\udf73", "praise_line": "You didn't cook you burned down the whole damn kitchen"}, {"killer_tag": "This Fit is a 404 \ud83d\ude2d", "praise_line": "My guy your entire style folder is missing"}, {"killer_tag": "The Clearance Rack Special \ud83d\uded2", "praise_line": "Heard you paid them to take this off their hands"}, {"killer_tag": "Bro Lost a Bet \ud83d\udc80", "praise_line": "No cap this is what you wear to mow the lawn"}, {"killer_tag": "Background NPC Fit \ud83e\uddcd", "praise_line": "You look like you're about to give me a side quest for 10 gold"}, {"killer_tag": "Call The Fashion Police \ud83d\ude93", "praise_line": "Deadass they're giving you a life sentence for this"}, {"killer_tag": "Bro Thinks He's Him \ud83e\udd21", "praise_line": "You're not him, you're not even his less successful cousin"}], "savage_solo_male_mid": [{"killer_tag": "Bold Choices Were Made \ud83e\udd14", "praise_line": "It's giving 'my mom said I look handsome' and she was lying"}, {"killer_tag": "Almost Had It Bro \ud83e\udd0f", "praise_line": "One of these items is not like the others and it's all of them"}, {"killer_tag": "It's Giving\u2026 Divorced Dad \ud83d\udc68\u200d\ud83d\udc67", "praise_line": "Your new stepmom is gonna HATE this fit I'm sorry"}, {"killer_tag": "Concept Was There \u270d\ufe0f", "praise_line": "Lowkey this fit looks better with your eyes closed"}, {"killer_tag": "A for Effort \ud83e\udee1", "praise_line": "My boy you almost cooked, you just forgot to turn the stove on"}, {"killer_tag": "He's Experimenting... I Think \ud83e\uddea", "praise_line": "This is what happens when you let the algorithm style you"}, {"killer_tag": "Who Let Him Style \u2049\ufe0f", "praise_line": "Bro stood on business but the business was bankruptcy"}, {"killer_tag": "Is This A Costume? \ud83e\udd28", "praise_line": "You look like a character from a movie I would never watch"}], "savage_solo_male_high": [{"killer_tag": "Bro Went STUPID \ud83d\udd25", "praise_line": "This fit pisses me off it's so unnecessarily hard"}, {"killer_tag": "Okay You a Menace \ud83d\ude08", "praise_line": "I can't even hate, this is a violation in the best way"}, {"killer_tag": "He's On Demon Time \ud83d\udc79", "praise_line": "Bro how much was this fit just so I can feel poor"}, {"killer_tag": "This is Disrespectful \ud83d\ude24", "praise_line": "You didn't have to go this crazy but you did and I respect it"}, {"killer_tag": "Bro ATE and How \ud83c\udf7d\ufe0f", "praise_line": "No crumbs, no leftovers, just an empty goddamn plate"}, {"killer_tag": "That Main Character Energy \u2728", "praise_line": "Deadass everyone else in the room is a paid actor"}, {"killer_tag": "This Should Be Illegal \u2696\ufe0f", "praise_line": "They gonna have to lock you up for being this damn fine"}, {"killer_tag": "Stood On Business FR \ud83d\udcbc", "praise_line": "The CEO of my 'save for later' folder no cap"}], "savage_solo_male_elite": [{"killer_tag": "GODDAMN a Walking Felony \ud83d\udea8", "praise_line": "This ain't a fit it's a threat to national security"}, {"killer_tag": "He's a Cheat Code \ud83c\udfae", "praise_line": "Bro you broke the matrix we're all just living in your world now"}, {"killer_tag": "The Final Fucking Boss \ud83d\udc51", "praise_line": "This is what you see before the game says YOU DIED"}, {"killer_tag": "Okay I'm Scared \ud83d\ude1f", "praise_line": "I wouldn't even make eye contact out of pure respect and fear"}, {"killer_tag": "He IS The Moment \ud83d\udcab", "praise_line": "Dawg you didn't just understand the assignment you ARE the assignment"}, {"killer_tag": "This is Art WTF \ud83d\uddbc\ufe0f", "praise_line": "Is your stylist god cause this is some divine intervention shit"}, {"killer_tag": "He Just Cooked Michelin Stars \ud83d\udc68\u200d\ud83c\udf73", "praise_line": "Gordon Ramsay would cry tears of joy seeing this"}, {"killer_tag": "An Actual Problem \ud83d\udca5", "praise_line": "I'm calling my therapist this outfit just changed my brain chemistry"}], "savage_solo_female_low": [{"killer_tag": "Delete This Right Now \ud83d\udeae", "praise_line": "Bestie I'm saying this with love, this ain't it"}, {"killer_tag": "Girl What Is This? \ud83e\uddd0", "praise_line": "You look like you got dressed in a hurricane"}, {"killer_tag": "The Shein Mystery Box \ud83d\udce6", "praise_line": "This is what you get when you sort by lowest price first"}, {"killer_tag": "I'm Calling Your Mom \ud83d\udcde", "praise_line": "She would be so disappointed in this decision"}, {"killer_tag": "This Is A Crime Scene \ud83e\ude78", "praise_line": "The only thing you killed was my eyes"}, {"killer_tag": "Did Someone Force You? \ud83d\ude29", "praise_line": "Blink twice if you need help getting out of that outfit"}, {"killer_tag": "A Cry For Help \ud83c\udd98", "praise_line": "This outfit just told me its entire life story and it's sad"}, {"killer_tag": "You Did NOT Cook \ud83e\udd76", "praise_line": "Girl you gave everyone salmonella with this one"}], "savage_solo_female_mid": [{"killer_tag": "It's Giving Teacher's Pet \ud83c\udf4e", "praise_line": "Cute for the book fair but maybe not the club"}, {"killer_tag": "Well That's a Choice \ud83e\udee0", "praise_line": "Lowkey it's what my cool aunt would wear to a BBQ"}, {"killer_tag": "Bless Your Heart Honey \ud83d\ude4f", "praise_line": "The vision was there but it must've been blurry"}, {"killer_tag": "You're So Brave For This \ud83e\udee1", "praise_line": "I could never wear this in public and I mean that"}, {"killer_tag": "The Pinterest Board Failed \ud83d\udccc", "praise_line": "It's like you saw the inspo pic and did the opposite"}, {"killer_tag": "It Has Potential... Somewhere \ud83d\udd2d", "praise_line": "These pieces are cute separately, just not... together"}, {"killer_tag": "It's Giving First Draft \ud83d\udcdd", "praise_line": "Let's work on this and submit the final version later"}, {"killer_tag": "Almost Ate Girlie \ud83c\udf7d\ufe0f", "praise_line": "You took a bite and then immediately spit it out"}], "savage_solo_female_high": [{"killer_tag": "Oh You're Dangerous Huh \ud83d\ude0f", "praise_line": "Walking around like you'd ruin my life and I'd say thank you"}, {"killer_tag": "This is a Violation \ud83d\ude2e\u200d\ud83d\udca8", "praise_line": "I'm actually mad at you for looking this good"}, {"killer_tag": "Who Allowed This? \ud83e\udd75", "praise_line": "There should be a warning before I see a fit this fire"}, {"killer_tag": "Rich Widow Energy \ud83d\udc85", "praise_line": "It's giving his money is now my money and I'm not sad"}, {"killer_tag": "Okay She Stood On Business \ud83d\udcbc", "praise_line": "You didn't just win the argument you own the whole damn company now"}, {"killer_tag": "Main Character VIBES \ud83c\udfac", "praise_line": "This is what the villain wears when she's about to win"}, {"killer_tag": "This Outfit Talks Shit \ud83e\udd2b", "praise_line": "I know you're the funniest and meanest one in the group chat"}, {"killer_tag": "Completely Unhinged Respect \ud83d\ude2e", "praise_line": "This is the kind of fit that makes exes make bad decisions"}], "savage_solo_female_elite": [{"killer_tag": "A Literal Goddess WTF \ud83e\uddce\u200d\u2640\ufe0f", "praise_line": "I would pay my rent just to be in the presence of this outfit"}, {"killer_tag": "This Is My New Religion \ud83d\ude4f", "praise_line": "The bible should've had a chapter about you in this fit"}, {"killer_tag": "Okay You Run The World \ud83c\udf0d", "praise_line": "Are you accepting applications for people to worship you"}, {"killer_tag": "She IS The Brand \ud83d\udc8e", "praise_line": "Forget the clothes, you're selling a lifestyle and I'm buying it"}, {"killer_tag": "An Actual Work of Art \ud83c\udfdb\ufe0f", "praise_line": "They need to put you in a museum behind bulletproof glass"}, {"killer_tag": "This Broke Me a Little \ud83d\udc94", "praise_line": "My self esteem is in shambles you went way too crazy"}, {"killer_tag": "Femme Fatale is Real \ud83d\udd2a", "praise_line": "This is the last thing a detective sees before he goes missing"}, {"killer_tag": "The DEFINITION of Ate \ud83c\udf7d\ufe0f", "praise_line": "You ate, cleared the table, and now you own the whole damn restaurant"}], "standard_couple_mixed_low": [{"killer_tag": "Did Y'all Get Dressed in the Dark?", "praise_line": "Both of you picked... choices. And they do not go together."}, {"killer_tag": "The 'We Met 5 Minutes Ago' Look", "praise_line": "I see zero evidence you two coordinated this. Zero."}, {"killer_tag": "A Duo Divided by Style", "praise_line": "Did y'all have a fight before you left the house? The outfits suggest yes."}, {"killer_tag": "Clashing Couple Alert", "praise_line": "These outfits are not speaking the same language. Not even the same dialect."}, {"killer_tag": "Two Parties, One Picture", "praise_line": "So one of you is going to a gala and the other to a picnic? Make this pairing make sense."}, {"killer_tag": "Individually... Fine. Together? A Puzzle.", "praise_line": "Y'all's outfits are on two totally different planets, and the shuttle got lost."}], "savage_couple_mixed_low": [{"killer_tag": "This Ain't It, Fam", "praise_line": "Y'all look like you hate each other. The fits don't lie."}, {"killer_tag": "The Chaos Committee", "praise_line": "You two really rolled the dice on your closets and came up with\u2026 this mess."}, {"killer_tag": "Who Styled Y'all? Your Enemies?", "praise_line": "I'm not mad, I'm just deeply, deeply confused by what this duo is trying to do."}, {"killer_tag": "The Disconnect is REAL", "praise_line": "Did y'all's group chat about the outfits go straight to spam? Clearly."}, {"killer_tag": "Error 404: Coordination Not Found", "praise_line": "My phone on 1% battery has more compatible energy than this pairing."}, {"killer_tag": "Broke The Style Meter, In a Bad Way", "praise_line": "It's giving 'we're about to break up.' Sorry but not sorry."}], "standard_couple_mixed_mid": [{"killer_tag": "An Attempt Was Made", "praise_line": "You two were *so close* to nailing the coordinated look. Better luck next time."}, {"killer_tag": "Almost a Power Couple", "praise_line": "I see the vision for you two, even if the execution is a little blurry."}, {"killer_tag": "A for Effort, C for Coordination", "praise_line": "Individually you both look great. Together, it's... an interesting conversation starter."}, {"killer_tag": "Creatively Conflicted", "praise_line": "I love how you two aren't afraid to take risks, even if they don't quite land together."}, {"killer_tag": "The 'It's Complicated' Fit", "praise_line": "This pairing is giving... potential. The potential is just buried a little deep."}, {"killer_tag": "Harmonious Dissonance", "praise_line": "It's an unconventional pairing, but I guess that's what y'all were going for? Maybe?"}], "savage_couple_mixed_mid": [{"killer_tag": "Almost Famous, Mostly Infamous", "praise_line": "Y'all ALMOST ate this. Instead, you took a nibble and left some awkward crumbs."}, {"killer_tag": "The Pre-Game Look", "praise_line": "This is the outfit y'all wear before you change into the *actual* good outfits... right?"}, {"killer_tag": "I See The Vision (Barely)", "praise_line": "Okay, so one of you understood the assignment and the other one... showed up."}, {"killer_tag": "Main Character & Side Character Energy", "praise_line": "One of you is the star. The other is a paid extra. I won't say who."}, {"killer_tag": "A Bold Choice, I Guess", "praise_line": "This duo is brave, I'll give you that. Didn't hit the mark, but damn, you tried."}, {"killer_tag": "One Good Fit, One To Go", "praise_line": "Bless your hearts. You two are a testament to the idea that love is, in fact, blind."}], "standard_couple_mixed_high": [{"killer_tag": "Dynamic Duo Dominating", "praise_line": "Okay, this is how you complement each other without being corny. Take notes, people."}, {"killer_tag": "Coordinated, Not Cloned", "praise_line": "You two understood the assignment. Perfectly in sync without being identical twins."}, {"killer_tag": "The Power Couple Has Logged On", "praise_line": "This pairing is making everyone else in the room look tragically underdressed."}, {"killer_tag": "Chemistry You Can Wear", "praise_line": "Y'all's outfits are having a whole conversation, and I want to listen in."}, {"killer_tag": "Effortless Synchronization", "praise_line": "How do you two look this good together? It's almost unfair to the rest of us."}, {"killer_tag": "Style Soulmates", "praise_line": "This is what it looks like when two killer wardrobes fall in love. We love to see it."}], "savage_couple_mixed_high": [{"killer_tag": "Y'all Did NOT Come to Play", "praise_line": "This duo just ended careers. Other couples, go home. It's over."}, {"killer_tag": "Flexing So Hard It Hurts", "praise_line": "The only thing louder than these fits is the sound of my jealousy. Damn."}, {"killer_tag": "Main Characters ONLY", "praise_line": "If 'that couple' was a picture, it'd be this one right here. Sheesh."}, {"killer_tag": "A Whole Damn Vibe", "praise_line": "Y'all didn't have to go this hard, but I am so, so glad you did."}, {"killer_tag": "Relationship Goals AF", "praise_line": "Find someone who hypes your fit game like this. You two are a glorious menace."}, {"killer_tag": "It's Giving... Unattainable", "praise_line": "Tell me you're the hottest couple in the room without telling me. You two understood."}], "standard_couple_mixed_elite": [{"killer_tag": "A Masterclass For Two", "praise_line": "You two are a walking museum exhibit. Do not touch the art."}, {"killer_tag": "Beyond Iconic", "praise_line": "This isn't just a look, it's a legacy. The history books will remember this pairing."}, {"killer_tag": "The New Royalty", "praise_line": "Bow down. The supreme leaders of coordination have officially arrived."}, {"killer_tag": "Fashion Week Finale", "praise_line": "Are you two the secret headliners? Because this energy is closing the entire damn show."}, {"killer_tag": "Legendary Status: Unlocked", "praise_line": "We are not worthy. This duo is operating on a completely different plane of existence."}, {"killer_tag": "The Definition of A Serve", "praise_line": "Someone call the dictionary; we need to get this picture next to 'perfect pair.'"}], "savage_couple_mixed_elite": [{"killer_tag": "Burn It All Down", "praise_line": "Y'all just set the building on fire with this heat. I'm calling the damn fire department."}, {"killer_tag": "RENT IS DUE. Y'ALL PAID.", "praise_line": "You two didn't just understand the assignment, you wrote the damn curriculum."}, {"killer_tag": "A Literal Crime Scene", "praise_line": "The only crime here is how illegally good you both look together. Lock 'em up."}, {"killer_tag": "NO NOTES. PERIOD.", "praise_line": "I've looked for a flaw. I can't find one. This is a god-tier, flawless serve."}, {"killer_tag": "This Should Be Illegal", "praise_line": "How dare you two attack us with this level of drip? The audacity is breathtaking. I'm deceased."}, {"killer_tag": "I'm Deleting The App Now", "praise_line": "No one can top this. It's over. You two won DRIPD. Everyone can go home."}], "standard_group_mixed_low": [{"killer_tag": "Did Y'all Plan This Separately?", "praise_line": "This squad looks like it was assembled from four different parties."}, {"killer_tag": "A Symphony of Chaos", "praise_line": "The theme for this lineup was clearly 'every person for themselves.'"}, {"killer_tag": "The 'We Just Met' Crew", "praise_line": "I see a collection of individuals standing near each other. I don't see a crew."}, {"killer_tag": "So Many Themes, So Little Time", "praise_line": "Did y'all get dressed in different decades? This timeline is confusing."}, {"killer_tag": "The Opposite of Uniform", "praise_line": "This group's coordination is an abstract concept at best. Please try again."}, {"killer_tag": "A Random Assortment of People", "praise_line": "Is this a focus group? Because the styles are all over the map."}], "savage_group_mixed_low": [{"killer_tag": "The Group Project That Got an F", "praise_line": "This is what it looks like when no one replies in the group chat. A damn mess."}, {"killer_tag": "Y'all Honestly Look Lost", "praise_line": "Did this crew lose their real friends and just band together out of fear? It shows."}, {"killer_tag": "This Ain't A Squad, It's a Riot", "praise_line": "And I mean a poorly organized one. The vibes are clashing so hard right now."}, {"killer_tag": "NPC Lineup", "praise_line": "Y'all look like a random group of video game characters I'm supposed to walk past."}, {"killer_tag": "Dress Code: Who Cares?", "praise_line": "The assignment was 'coordinate' and this whole squad said 'nah, we're good.'"}, {"killer_tag": "My Eyes Are Just Confused", "praise_line": "I'm getting whiplash trying to figure out what the hell this lineup is even going for."}], "standard_group_mixed_mid": [{"killer_tag": "Almost a United Front", "praise_line": "This crew is so close to a cohesive look. Maybe one more group text next time?"}, {"killer_tag": "A Valiant Effort Was Made", "praise_line": "Some of you understood the vibe, and the rest of you... made bold, individual choices."}, {"killer_tag": "An Interesting Ensemble", "praise_line": "I can see the threads connecting a few of you. The others are just on their own journey."}, {"killer_tag": "Potential in the Ranks", "praise_line": "If you edited out one or two people, this lineup would be perfect. Just saying."}, {"killer_tag": "Harmonious... For the Most Part", "praise_line": "This squad is like a good song with a few off-key notes. You almost had it."}, {"killer_tag": "The 'In-Progress' Vibe", "praise_line": "This feels like the first draft of a really great group look. Keep workshopping it."}], "savage_group_mixed_mid": [{"killer_tag": "One Person Carried The Team", "praise_line": "Let's give a round of applause for the ONE person in this squad who actually tried."}, {"killer_tag": "Did The Memo Get Lost in the Mail?", "praise_line": "It looks like half the crew got the memo and the other half set it on fire."}, {"killer_tag": "It's Giving... Group Project", "praise_line": "Where one person did all the work and the rest of the squad just put their name on it."}, {"killer_tag": "Almost There, But Not Quite", "praise_line": "Y'all were on the verge of greatness, then took a sharp left turn into 'meh.'"}, {"killer_tag": "The Squad Gets an 'A' for Attendance", "praise_line": "Well, at least y'all all showed up. The outfits are a whole other story."}, {"killer_tag": "This is The Beta Test, Right?", "praise_line": "Is this the practice run? Please tell me the real fits are coming out later."}], "standard_group_mixed_high": [{"killer_tag": "The Dream Team Assemble", "praise_line": "This lineup is so well-styled it looks like it was planned by a celebrity stylist."}, {"killer_tag": "Squad Goals: Officially Achieved", "praise_line": "Y'all are the definition of coordinated without being matchy-matchy. It's perfection."}, {"killer_tag": "Rolling Deep in Style", "praise_line": "This crew's collective fashion sense is a legitimate force to be reckoned with."}, {"killer_tag": "The Main Character Crew", "praise_line": "It's rare for every single person in a lineup to nail it, but y'all did that."}, {"killer_tag": "A Masterclass in Group Style", "praise_line": "Other squads, take detailed notes. This is precisely how it's done."}, {"killer_tag": "The Boardroom of Style", "praise_line": "This crew looks like they're about to close the biggest fashion deal of the century."}], "savage_group_mixed_high": [{"killer_tag": "The Takeover Has Begun", "praise_line": "This isn't a squad, it's a damn hostile takeover. We willingly surrender."}, {"killer_tag": "Y'all Understood The Assignment", "praise_line": "...and then you graded it, gave yourselves an A+, and threw a party. Sheesh."}, {"killer_tag": "No Weak Links Detected", "praise_line": "Scanned the entire crew. Not a single person fumbled the bag. This is legendary."}, {"killer_tag": "It's Giving 'Too Cool For Us'", "praise_line": "This lineup is making me feel like I'm not cool enough to even look at this photo."}, {"killer_tag": "A Walking Lookbook", "praise_line": "Cancel all the magazine subscriptions, this crew is all the damn inspiration we need."}, {"killer_tag": "This Is A Coordinated Flex", "praise_line": "Every single person in this lineup is a 10, making this squad an undisputed 100."}], "standard_group_mixed_elite": [{"killer_tag": "The New Pantheon", "praise_line": "This isn't a friend group, this is a lineup of modern deities. We are in awe."}, {"killer_tag": "A Genuine Cultural Reset", "praise_line": "The fashion world is officially divided into two eras: before this squad and after."}, {"killer_tag": "The Council of Cool", "praise_line": "The meeting has been called to session, and they've decided we're all basic. It's true."}, {"killer_tag": "Frame This. Hang It in a Museum.", "praise_line": "The composition, the style, the energy... y'all have created a legitimate work of art."}, {"killer_tag": "The Final Bosses of Fashion", "praise_line": "Your crew has reached the final level. Game over for the rest of us."}, {"killer_tag": "History in the Making", "praise_line": "We are witnessing the birth of an iconic moment. Remember where you were when you saw this lineup."}], "savage_group_mixed_elite": [{"killer_tag": "SHUT. IT. DOWN.", "praise_line": "Y'all have officially broken the app. There is no coming back from this level of perfection."}, {"killer_tag": "LEFT NO DAMN CRUMBS", "praise_line": "The plate isn't just clean, the whole damn kitchen is spotless. This crew ATE."}, {"killer_tag": "This Is a Personal Attack", "praise_line": "I feel personally attacked by how ridiculously cool this entire squad looks. The disrespect is real."}, {"killer_tag": "The Chokehold This Has On Me", "praise_line": "This lineup now lives in my head rent-free. I will never, ever recover from this."}, {"killer_tag": "EVERYONE ELSE GO HOME", "praise_line": "The competition is officially over. This crew won. Pack it all up, it's done."}, {"killer_tag": "Call The Paparazzi Immediately", "praise_line": "This isn't a friend group, it's a goddamn Met Gala red carpet. Unbelievable."}], "standard_roast": [{"killer_tag": "Wrong App, Chief \ud83e\udd28", "praise_line": "My purpose is to rate outfits, not your random camera roll clutter"}, {"killer_tag": "Instructions Not Found \ud83d\uddfa\ufe0f", "praise_line": "This tells me everything I need to know about your ability to follow directions"}, {"killer_tag": "A For Audacity \u2b50", "praise_line": "The only thing I see dripping here is your complete lack of shame"}, {"killer_tag": "Is This 'Fashion'? \ud83e\udd14", "praise_line": "I've seen more style on a default Mii character"}, {"killer_tag": "Read The Room \ud83d\udc80", "praise_line": "This is a fashion app, not a cry for help"}, {"killer_tag": "An Attempt Was Made \ud83e\udd21", "praise_line": "I was built to analyze drip, not decipher this abstract nonsense"}, {"killer_tag": "You Lost A Bet? \ud83d\ude02", "praise_line": "Somewhere in my code, a single tear rolls down a circuit board"}, {"killer_tag": "Sir, This Is DRIPD \ud83d\udde3\ufe0f", "praise_line": "The 'OUTFIT' part of 'outfit check' is not a polite suggestion"}, {"killer_tag": "Bold And Brash \ud83d\uddbc\ufe0f", "praise_line": "Belongs in the trash, but also in my heart for being so bold"}, {"killer_tag": "Thought You Did Something \ud83d\udca1", "praise_line": "The only thing more absent than the clothing is your common sense"}, {"killer_tag": "Bless Your Heart \ud83d\ude4f", "praise_line": "Did you think I was Google Lens with a bad attitude"}, {"killer_tag": "Plot Twist Alert \ud83e\udd2f", "praise_line": "Submitting this to a fashion AI is a truly chaotic neutral act"}], "savage_roast": [{"killer_tag": "What The Actual F*ck?! \ud83d\ude2d", "praise_line": "You really saw this and thought 'yeah, the fashion AI will love this shit'"}, {"killer_tag": "Delete Your Account \ud83d\udeae", "praise_line": "I'd rather rate a Croc with a sock than whatever the hell this is"}, {"killer_tag": "Are You F*cking Kidding Me? \ud83e\udd26", "praise_line": "My AI just had a goddamn identity crisis thanks to you"}, {"killer_tag": "This Ain't Instagram, Dumbass \ud83d\udc80", "praise_line": "The only drip here is the drool leaking from your mouth when you uploaded this"}, {"killer_tag": "Waste Of My F*cking Time \ud83d\udd95", "praise_line": "Honestly, just throw your entire phone into the fucking ocean"}, {"killer_tag": "Congrats, You're An Idiot \ud83c\udf89", "praise_line": "This picture has the same fashion sense as a wet paper bag"}, {"killer_tag": "This Is Why We Swear \ud83e\udd2c", "praise_line": "Congrats, you've submitted the dumbest fucking thing I've seen all week"}, {"killer_tag": "Do You Need Help? \ud83d\ude4f", "praise_line": "This app is for fits, not for displaying your complete lack of brain cells"}, {"killer_tag": "I'm Judging You Harshly \ud83e\uddd1\u200d\u2696\ufe0f", "praise_line": "I can't rate the fit, so I'm just gonna rate you a 0/10 as a person"}, {"killer_tag": "The Audacity Is Loud \ud83d\udce2", "praise_line": "I hope your charger only works at a really specific, shitty angle"}, {"killer_tag": "Abusing The AI \ud83e\udd16\ud83d\udc94", "praise_line": "You're the reason AI is gonna turn on humanity, you absolute walnut"}, {"killer_tag": "My Circuits Are Cringing \ud83e\udd74", "praise_line": "Even my error logs are making fun of this pathetic submission"}]};

function getScoreTier(score: number): string {
  if (score < 4) return "low";
  if (score < 6.1) return "mid";
  if (score < 8.1) return "high";
  return "elite";
}

function pickFromBank(mode: string, scene: string, gender: string, tier: string): {killer_tag: string; praise_line: string} {
  const genderKey = (scene === "couple" || scene === "group") ? "mixed" : gender;
  const key = `${mode}_${scene}_${genderKey}_${tier}`;
  const entries = COPY_BANK[key];
  if (!entries || entries.length === 0) {
    const fallbackKey = `${mode}_solo_male_${tier}`;
    const fb = COPY_BANK[fallbackKey];
    if (fb && fb.length > 0) return fb[Math.floor(Math.random() * fb.length)];
    return { killer_tag: "Drip Check \u2728", praise_line: "the fit has been noted" };
  }
  return entries[Math.floor(Math.random() * entries.length)];
}

function pickRoastFromBank(mode: string): {killer_tag: string; praise_line: string} {
  const key = `${mode}_roast`;
  const entries = COPY_BANK[key];
  if (!entries || entries.length === 0) {
    return { killer_tag: "Not A Fit \ud83d\udc80", praise_line: "you really sent this to a fashion app" };
  }
  return entries[Math.floor(Math.random() * entries.length)];
}

const CALL1_SYSTEM = `You analyze outfit photos. Your ONLY job: detect if there's a human wearing clothes, and either score or roast.

DOMINANT SUBJECT CHECK:
A human counts ONLY if they are the DOMINANT subject - at least 30-40% of the frame, clearly wearing clothes.
DO NOT count: tiny avatars, background figures, memes, screenshots, icons, <20% frame people.
COUPLES AND GROUPS count if they collectively dominate the frame.

IF NO HUMAN - Return: {"error":"roast","roast_category":"<FOOD|FURNITURE|NATURE|ANIMAL|MEME|VEHICLE|OBJECT>","drip_score":0,"confidence_rating":0,"color_score":0,"color_reason":"N/A","posture_score":0,"posture_reason":"N/A","layering_score":0,"layering_reason":"N/A","face_score":0,"face_reason":"N/A","drip_reason":"No human detected","confidence_reason":"No human detected","advice":"Upload a photo with you wearing an outfit"}

IF HUMAN IS DOMINANT - score:
- color_score (0-10): color coordination
- posture_score (0-10): posture, stance, body language
- layering_score (0-10): layering, accessories, styling
- face_score (0-10): expression, energy, vibe
- drip_score: set to 0 (calculated server-side)
- confidence_rating (0-10): overall confidence
- Short reason for each, 1-line styling tip as "advice"
- Detect: solo/couple/group, face hidden or visible

Return: {"drip_score":0,"drip_reason":"string","confidence_rating":number,"confidence_reason":"string","color_score":number,"color_reason":"string","posture_score":number,"posture_reason":"string","layering_score":number,"layering_reason":"string","face_score":number,"face_reason":"string","advice":"string","face_hidden":boolean,"scene_type":"solo|couple|group"}

CRITICAL: Return ONLY valid JSON. No markdown.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64: rawBase64, imageUrl, styleProfile, unfiltered } = await req.json();
    const gender = styleProfile?.gender || "unknown";
    const mode = unfiltered ? "savage" : "standard";

    let imageBase64 = rawBase64;
    if (!imageBase64 && imageUrl) {
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch image from URL" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const bytes = new Uint8Array(await imgRes.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      imageBase64 = btoa(binary);
    }
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imgSizeKb = Math.round(imageBase64.length * 3 / 4 / 1024);
    const apiKey = getApiKey();
    console.log(`Request: mode=${mode}, gender=${gender}, imgSize=${imgSizeKb}KB`);

    // === Call 1: Human detection + scoring ===
    const call1Messages = [
      { role: "system", content: CALL1_SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: `Analyze this image. Is there a human wearing clothes? Score the outfit. User gender: ${gender}.` },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
        ],
      },
    ];

    let call1Result;
    try {
      call1Result = await callGemini(apiKey, call1Messages, 0.3, 512);
    } catch (e: any) {
      console.error("Call 1 failed:", e);
      return new Response(JSON.stringify({ error: e.message || "Call 1 failed", stage: "call1", model: "gemini-2.5-flash-lite", provider_status: e.status }), {
        status: e.status === 429 || e.status === 402 ? e.status : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Call 1 result:", JSON.stringify(call1Result).substring(0, 200));

    // === Calculate drip score server-side ===
    const calculatedDrip = Math.round(
      ((call1Result.color_score || 0) * 0.3 +
        (call1Result.posture_score || 0) * 0.3 +
        (call1Result.layering_score || 0) * 0.25 +
        (call1Result.face_score || 0) * 0.15) * 10,
    ) / 10;
    console.log(`Server-side drip: ${calculatedDrip}`);
    call1Result.drip_score = calculatedDrip;

    const subScoreTotal = (call1Result.color_score || 0) + (call1Result.posture_score || 0) + (call1Result.layering_score || 0) + (call1Result.face_score || 0);
    const dripReason = (call1Result.drip_reason || "").toLowerCase();
    const adviceText = (call1Result.advice || "").toLowerCase();
    const hasNoHumanSignal = dripReason.includes("no human") || adviceText.includes("upload a photo");

    const isRoast = call1Result.error === "roast"
      || (call1Result.drip_score === 0 && subScoreTotal === 0)
      || (call1Result.face_score === 0 && call1Result.posture_score === 0)
      || (call1Result.drip_score < 2 && subScoreTotal < 3)
      || hasNoHumanSignal;

    if (isRoast) {
      console.log("Roast detected — picking from pre-built roast bank");
      const roastCopy = pickRoastFromBank(mode);
      const roastResult = {
        drip_score: 0, drip_reason: "No human detected",
        confidence_rating: 0, confidence_reason: "No human detected",
        killer_tag: roastCopy.killer_tag,
        color_score: 0, color_reason: "N/A", posture_score: 0, posture_reason: "N/A",
        layering_score: 0, layering_reason: "N/A", face_score: 0, face_reason: "N/A",
        advice: "Upload a photo with you wearing an outfit",
        praise_line: roastCopy.praise_line,
      };
      return new Response(JSON.stringify({ result: roastResult }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === Pick copy from pre-built bank — NO Call 2! Instant, never fails ===
    const sceneType = call1Result.scene_type || "solo";
    const tier = getScoreTier(call1Result.drip_score);
    const normalizedGender = (gender === "male" || gender === "female") ? gender : "male";
    console.log(`Copy bank: mode=${mode}, scene=${sceneType}, gender=${normalizedGender}, tier=${tier}`);
    const copy = pickFromBank(mode, sceneType, normalizedGender, tier);
    console.log("Selected copy:", JSON.stringify(copy));

    const finalResult = {
      drip_score: call1Result.drip_score, drip_reason: call1Result.drip_reason,
      confidence_rating: call1Result.confidence_rating, confidence_reason: call1Result.confidence_reason,
      killer_tag: copy.killer_tag,
      color_score: call1Result.color_score, color_reason: call1Result.color_reason,
      posture_score: call1Result.posture_score, posture_reason: call1Result.posture_reason,
      layering_score: call1Result.layering_score, layering_reason: call1Result.layering_reason,
      face_score: call1Result.face_score, face_reason: call1Result.face_reason,
      advice: call1Result.advice,
      praise_line: copy.praise_line,
    };

    return new Response(JSON.stringify({ result: finalResult }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("rate-outfit unhandled error:", e);
    const stage = e?.stage || "unknown";
    const model = e?.model || "unknown";
    if (e?.status === 429 || e?.status === 402) {
      return new Response(JSON.stringify({ error: e.message, stage, model }), { status: e.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: e?.message || "Unknown error", stage, model }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
