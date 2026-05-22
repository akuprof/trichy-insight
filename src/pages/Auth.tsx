import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const Auth = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isSignup) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        toast({ title: "பதிவு தோல்வி", description: error.message, variant: "destructive" });
      } else {
        toast({
          title: "பதிவு வெற்றி",
          description: "உங்கள் email-ஐ சரிபார்த்து உறுதிப்படுத்தும் இணைப்பை திறக்கவும்.",
        });
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        toast({ title: "உள்நுழைவு தோல்வி", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "வரவேற்பு", description: "நீங்கள் வெற்றிகரமாக உள்நுழைந்துள்ளீர்கள்." });
        navigate("/", { replace: true });
      }
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-heading text-2xl uppercase">{isSignup ? "கணக்கு உருவாக்கு" : "உள்நுழைவு"}</CardTitle>
          <CardDescription>
            {isSignup ? "Email மற்றும் password கொண்டு புதிய கணக்கு உருவாக்குங்கள்." : "உங்கள் கணக்கில் உள்நுழைய email மற்றும் password உள்ளிடுங்கள்."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 mb-6">
            <Button type="button" variant={!isSignup ? "default" : "secondary"} onClick={() => setIsSignup(false)}>
              உள்நுழைவு
            </Button>
            <Button type="button" variant={isSignup ? "default" : "secondary"} onClick={() => setIsSignup(true)}>
              பதிவு
            </Button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
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

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>

            {!isSignup && (
              <div className="text-right">
                <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                  Password மறந்துவிட்டதா?
                </Link>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "செயலாக்கப்படுகிறது..." : isSignup ? "பதிவு செய்ய" : "உள்நுழைய"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
};

export default Auth;
