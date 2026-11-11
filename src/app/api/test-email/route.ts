import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-guards";
import { sendEmail } from "@/lib/email";

// Quick check that the SMTP settings work: open
//   /api/test-email?to=you@example.com
// while signed in as the platform owner. Owner-only so strangers can't use
// the site to send email.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.isPlatformOwner) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const to = request.nextUrl.searchParams.get("to")?.trim() ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: "Add ?to=you@example.com with a valid email address" }, { status: 400 });
  }

  try {
    const { messageId } = await sendEmail(to, "Racik EventMu test email", "<p>Your email settings work. 🎉</p>");
    return NextResponse.json({ ok: true, to, messageId });
  } catch (err) {
    // Show the mail server's reason so wrong settings are easy to spot.
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
