import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const ForgotPassword = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendReset = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast({ title: "அனுப்ப முடியவில்லை", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "இணைப்பு அனுப்பப்பட்டது", description: "Password reset link உங்கள் email-க்கு அனுப்பப்பட்டுள்ளது." });
      setEmail("");
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-heading text-2xl uppercase">Password Reset</CardTitle>
          <CardDescription>உங்கள் account email ஐ உள்ளிடுங்கள்; reset link அனுப்பப்படும்.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSendReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "அனுப்பப்படுகிறது..." : "Reset link அனுப்பு"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            <Link to="/auth" className="text-primary hover:underline">
              உள்நுழைவு பக்கத்துக்கு திரும்பு
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default ForgotPassword;
