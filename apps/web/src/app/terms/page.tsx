import Link from "next/link";
import { BranchWordmark } from "@/components/brand/branch-mark";
import { serverEnv } from "@/lib/env";

export const metadata = {
  title: "Terms of service",
  description: "The rules for using Branch and the Branch for LeetCode extension.",
};

const EFFECTIVE = "November 11, 2026";

/**
 * Public, beside the privacy policy. Owner decisions (2026-11-11): "Branch" with no person named,
 * 13 and older, California law; sign-up shows that continuing means agreeing.
 */
export default function TermsPage() {
  const contact = serverEnv().PRIVACY_CONTACT_EMAIL;
  const contactLine = contact ? (
    <>
      email <a href={`mailto:${contact}`}>{contact}</a>
    </>
  ) : (
    "use the contact email on the Chrome Web Store listing"
  );

  return (
    <div className="flex min-h-dvh flex-col px-4 py-6 sm:px-8">
      <Link href="/" className="self-start rounded-md py-1">
        <BranchWordmark />
      </Link>
      <main className="prose-branch mx-auto w-full max-w-2xl py-10">
        <h1>Terms of service</h1>
        <p className="text-ink-muted">Effective {EFFECTIVE}</p>

        <p>
          These terms are the agreement between you and Branch (&quot;we&quot;) for using the Branch
          web app and its Chrome extension, Branch for LeetCode. By creating an account or using
          Branch, you agree to them. The <Link href="/privacy">privacy policy</Link> explains what
          we collect and why; it&apos;s part of these terms. Branch is independent and not
          affiliated with LeetCode or NeetCode.
        </p>

        <h2>Who can use Branch</h2>
        <ul>
          <li>You must be at least 13 years old.</li>
          <li>
            You sign in with Google or GitHub, under their terms. Keep that account secure: what
            happens in Branch through your account is your responsibility. One account per person.
          </li>
          <li>
            The extension&apos;s connection key works like a password for syncing. Don&apos;t share
            it; disconnect a browser in Settings if a key might be exposed.
          </li>
        </ul>

        <h2>What you post</h2>
        <ul>
          <li>
            You keep ownership of what you write and share: posts, comments, notes, and your code.
          </li>
          <li>
            You give us permission to store, process, and show it as needed to run Branch: to the
            groups you post in, and privately to you (for example, estimating your code&apos;s
            complexity). We don&apos;t use it for anything else, and this permission ends when you
            delete it, apart from short-lived backups.
          </li>
          <li>
            Only post what you have the right to share. Don&apos;t paste other people&apos;s
            copyrighted material, such as problem statements copied from other sites or paid
            solutions.
          </li>
        </ul>

        <h2>Using Branch fairly</h2>
        <p>Don&apos;t use Branch to:</p>
        <ul>
          <li>harass, threaten, or abuse anyone, or post hateful, sexual, or illegal content;</li>
          <li>spam, or pretend to be someone else;</li>
          <li>get into groups or accounts you weren&apos;t invited to or don&apos;t own;</li>
          <li>
            probe, attack, or overload Branch, get around its limits, or collect data from it with
            automated tools (the extension is the only automated access);
          </li>
          <li>break the law, or other sites&apos; terms, through Branch.</li>
        </ul>
        <p>
          Group admins can remove posts and comments in their group, and members can report them to
          the admin. We may remove content or suspend accounts that break these terms.
        </p>

        <h2>LeetCode, neetcode.io, and the extension</h2>
        <p>
          The extension reads the results of submissions you make on leetcode.com and neetcode.io
          and sends accepted ones to Branch, as the <Link href="/privacy">privacy policy</Link>{" "}
          describes. You&apos;re responsible for using those sites within their own terms. Branch
          isn&apos;t endorsed by them, and their changes can stop the extension working at any time;
          marking problems solved by hand always works.
        </p>

        <h2>Estimates and statistics</h2>
        <p>
          Complexity estimates, review suggestions, timers, and statistics are approximate. Branch
          reads code without running it, and its estimates can be wrong. They&apos;re for your own
          practice, not professional advice, and we make no promise about interviews or their
          results.
        </p>

        <h2>The service</h2>
        <ul>
          <li>Branch is free. It runs on free hosting plans, which have limits.</li>
          <li>
            We may change, pause, or stop features, or Branch as a whole. Where we can, we&apos;ll
            say so beforehand on the site.
          </li>
          <li>
            Branch is provided &quot;as is&quot;, without warranties of any kind, as far as the law
            allows. It can be unavailable, slow, or wrong, and data can be lost; keep your own copy
            of anything you can&apos;t afford to lose.
          </li>
          <li>
            As far as the law allows, we aren&apos;t liable for indirect or consequential losses,
            and our total liability for any claim about Branch is limited to US$50.
          </li>
          <li>
            If your use of Branch breaks these terms or the law and someone makes a claim against us
            because of it, you&apos;re responsible for that claim.
          </li>
        </ul>

        <h2>Ending your use</h2>
        <p>
          You can stop using Branch at any time. To delete your account and everything in it,{" "}
          {contactLine}. We may suspend or end an account that breaks these terms. The sections on
          what you post, estimates, the service, and the law that applies continue after an account
          ends.
        </p>

        <h2>Changes to these terms</h2>
        <p>
          When these terms change, the date above changes, and a meaningful change also appears on
          the <Link href="/changelog">What&apos;s new</Link> page. Using Branch after a change means
          you accept the new terms.
        </p>

        <h2>The law that applies</h2>
        <p>
          These terms are governed by the laws of California, USA, without regard to its rules on
          conflicts of law. Any dispute is for the state or federal courts in California, unless the
          law where you live gives you the right to bring it there.
        </p>

        <h2>Contact</h2>
        <p>For anything about these terms, {contactLine}.</p>
      </main>
    </div>
  );
}
