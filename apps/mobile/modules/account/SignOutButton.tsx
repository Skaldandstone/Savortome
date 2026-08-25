import { useAuth } from "@clerk/expo";
import { Button } from "@/ui";

export function SignOutButton() {
  const { signOut } = useAuth();
  return <Button label="Sign out" variant="ghost" onPress={() => void signOut()} />;
}
