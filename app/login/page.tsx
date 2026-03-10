import Link from "next/link";
import Image from "next/image";
import { GoogleLoginButton } from "@/components/GoogleLoginButton";
import { getSupabaseUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const user = await getSupabaseUser()
  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left Panel: Branding & Feature Highlights ── */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-teal-800 via-teal-900 to-teal-950 overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-600/10 rounded-full -translate-y-1/4 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-500/5 rounded-full translate-y-1/4 -translate-x-1/4" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.02) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-16 xl:p-20 w-full">
          {/* Logo */}
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-3 group"
            >
              <Image
                src="/images/amber_teal-logo.png"
                alt="AutoMyReply"
                width={40}
                height={40}
                className="h-10 w-auto"
              />
              <span className="text-xl font-bold text-white tracking-tight">
                AutoMyReply
              </span>
            </Link>
          </div>

          {/* Center content */}
          <div className="max-w-md">
            <h2 className="text-4xl xl:text-[2.75rem] font-extrabold text-white leading-[1.15] mb-5 tracking-tight">
              Turn every review into a
              <span className="block mt-1 text-amber-400">
                growth opportunity
              </span>
            </h2>
            <p className="text-teal-200/70 text-lg leading-relaxed mb-14">
              AI-powered replies that sound like you, delivered in seconds. Join
              hundreds of businesses that never miss a review.
            </p>

            {/* Feature list */}
            <div className="space-y-6">
              {[
                {
                  icon: (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  ),
                  title: "AI replies in under 5 seconds",
                  desc: "Context-aware, on-brand responses generated instantly",
                },
                {
                  icon: (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  ),
                  title: "Secure Google integration",
                  desc: "OAuth 2.0 with encrypted tokens — your data stays safe",
                },
                {
                  icon: (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  ),
                  title: "Built for teams",
                  desc: "Multi-location, multi-member collaboration from day one",
                },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-amber-400/80"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      {feature.icon}
                    </svg>
                  </div>
                  <div>
                    <div className="font-semibold text-white/90 text-[15px]">
                      {feature.title}
                    </div>
                    <div className="text-teal-300/50 text-sm mt-1">
                      {feature.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Testimonial */}
          <div className="max-w-md mt-6">
            <div className="bg-white/[0.04] backdrop-blur-sm rounded-2xl p-6 border border-white/[0.06]">
              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className="w-3.5 h-3.5 text-amber-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-white/70 text-sm leading-relaxed mb-4">
                &ldquo;AutoMyReply cut our review response time from hours to
                seconds. The AI replies are so natural that customers can&apos;t
                tell the difference.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-teal-950 text-xs font-bold">
                  RT
                </div>
                <div>
                  <div className="text-white/80 text-sm font-medium">
                    Rachel Torres
                  </div>
                  <div className="text-teal-400/40 text-xs">
                    Operations Manager, Peak Fitness
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Panel: Login Form ── */}
      <div className="w-full lg:w-1/2 flex flex-col min-h-screen bg-gray-50">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between p-6 bg-white border-b border-gray-100">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5"
          >
            <Image
              src="/images/amber_teal-logo.png"
              alt="AutoMyReply"
              width={32}
              height={32}
              className="h-8 w-auto"
            />
            <span className="text-lg font-bold text-gray-900">AutoMyReply</span>
          </Link>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            Back to home
          </Link>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-8 sm:px-16 lg:px-20 py-16">
          <div className="w-full max-w-[380px]">
            {/* Heading */}
            <div className="mb-12">
              <div className="hidden lg:block mb-8">
                <Image
                  src="/images/amber_teal-logo.png"
                  alt="AutoMyReply"
                  width={44}
                  height={44}
                  className="h-11 w-auto"
                />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-3">
                Welcome back
              </h1>
              <p className="text-gray-500 text-[15px] leading-relaxed">
                Sign in to manage your reviews and grow your business.
              </p>
            </div>

            {/* Error from URL params */}
            {searchParams?.error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl mb-8">
                <svg
                  className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm text-red-600">{searchParams.error}</p>
              </div>
            )}

            {/* Google Login Button */}
            <GoogleLoginButton />

            {/* Divider */}
            <div className="relative my-10">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-gray-50 px-4 text-[11px] text-gray-400 uppercase tracking-widest font-medium">
                  secure sign-in
                </span>
              </div>
            </div>

            {/* Trust signals */}
            <div className="space-y-5 mb-10">
              {[
                {
                  text: "No password needed — Google handles authentication",
                  icon: (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  ),
                },
                {
                  text: "Your data is encrypted and never shared",
                  icon: (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  ),
                },
                {
                  text: "Free plan available — no credit card required",
                  icon: (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  ),
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3.5"
                >
                  <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-[18px] h-[18px] text-teal-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      {item.icon}
                    </svg>
                  </div>
                  <span className="text-[13px] text-gray-500 leading-snug">
                    {item.text}
                  </span>
                </div>
              ))}
            </div>

            {/* Legal */}
            <p className="text-xs text-gray-400 leading-relaxed">
              By signing in, you agree to our{" "}
              <Link
                href="/terms"
                className="text-teal-600 hover:text-teal-700 underline underline-offset-2 decoration-teal-600/30"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="text-teal-600 hover:text-teal-700 underline underline-offset-2 decoration-teal-600/30"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>

        {/* Desktop back link */}
        <div className="hidden lg:flex items-center justify-center pb-10">
          <Link
            href="/"
            className="group inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-teal-600 transition-colors"
          >
            <svg
              className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
