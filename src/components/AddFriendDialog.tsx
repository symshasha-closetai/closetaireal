import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Search, UserPlus, Loader2, X } from "lucide-react";

type SearchResult = {
  user_id: string;
  username: string;
  name: string | null;
  avatar_url: string | null;
};

interface AddFriendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingFriendIds: string[];
  onFriendAdded: () => void;
}

const AddFriendDialog = ({ open, onOpenChange, existingFriendIds, onFriendAdded }: AddFriendDialogProps) => {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim() || query.trim().length < 2) return;
    setSearching(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, username, name, avatar_url")
      .ilike("username", `%${query.trim()}%`)
      .neq("user_id", user?.id || "")
      .limit(10) as any;

    if (error) {
      toast.error("Search failed");
      setResults([]);
    } else {
      setResults((data || []).filter((r: any) => r.username));
    }
    setSearching(false);
  };

  const handleAdd = async (friendUserId: string) => {
    if (!user) return;
    setAdding(friendUserId);
    const { error } = await supabase.from("friends" as any).insert({
      user_id: user.id,
      friend_id: friendUserId,
    } as any);
    if (error) {
      if (error.code === "23505") toast.info("Already friends!");
      else toast.error("Failed to add friend");
    } else {
      toast.success("Friend added! 🎉");
      onFriendAdded();
    }
    setAdding(null);
  };

  const isFriend = (userId: string) => existingFriendIds.includes(userId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Add Friend</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search by username..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <button onClick={handleSearch} disabled={searching || query.trim().length < 2}
              className="px-4 py-2.5 rounded-xl gradient-accent text-accent-foreground text-xs font-medium disabled:opacity-60">
              {searching ? <Loader2 size={14} className="animate-spin" /> : "Search"}
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {results.length === 0 && !searching && query.length > 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No users found</p>
            )}
            {results.map((r) => (
              <div key={r.user_id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                  {r.avatar_url ? (
                    <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground">{(r.name || r.username)?.[0]?.toUpperCase()}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.name || r.username}</p>
                  <p className="text-[10px] text-muted-foreground">@{r.username}</p>
                </div>
                {isFriend(r.user_id) ? (
                  <span className="text-[10px] text-muted-foreground px-2 py-1 rounded-full bg-muted">Added</span>
                ) : (
                  <button onClick={() => handleAdd(r.user_id)} disabled={adding === r.user_id}
                    className="w-8 h-8 rounded-full gradient-accent flex items-center justify-center">
                    {adding === r.user_id ? <Loader2 size={14} className="animate-spin text-accent-foreground" /> : <UserPlus size={14} className="text-accent-foreground" />}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddFriendDialog;
