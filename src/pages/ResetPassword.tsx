import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const isRecovery = useMemo(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace("#", ""));
    return hashParams.get("type") === "recovery";
  }, []);

  useEffect(() => {
    if (!isRecovery) {
      toast({
        title: "செல்லுபடியாகாத இணைப்பு",
        description: "Password reset செய்ய email-இல் வந்த recovery link மூலமே இந்தப் பக்கத்தை திறக்கவும்.",
        variant: "destructive",
      });
    }
  }, [isRecovery, toast]);

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();

    if (!isRecovery) {
      return;
    }

    if (password.length < 6) {
      toast({ title: "பலவீனமான password", description: "குறைந்தது 6 எழுத்துகள் வேண்டும்.", variant: "destructive" });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: "Password பொருந்தவில்லை", description: "இரு password-களும் ஒரே மாதிரி இருக்க வேண்டும்.", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast({ title: "மாற்ற முடியவில்லை", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password மாற்றப்பட்டது", description: "இப்போது புதிய password கொண்டு உள்நுழையலாம்." });
      navigate("/auth", { replace: true });
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-heading text-2xl uppercase">புதிய Password அமைக்கவும்</CardTitle>
          <CardDescription>பாதுகாப்பான புதிய password ஒன்றை அமைத்து account-ஐ மீண்டும் அணுகுங்கள்.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">புதிய Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Password உறுதிப்படுத்து</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading || !isRecovery}>
              {loading ? "சேமிக்கப்படுகிறது..." : "Password புதுப்பிக்க"}
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

export default ResetPassword;
