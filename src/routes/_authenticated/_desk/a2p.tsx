import { createFileRoute } from "@tanstack/react-router";
import { A2pRegistration } from "@/components/a2p-onboarding";
export const Route = createFileRoute("/_authenticated/_desk/a2p")({
  head: () => ({
    meta: [
      { title: "A2P Registration · EST8 CallDesk" },
      {
        name: "description",
        content:
          "Register your legal business and SMS campaign, review Telnyx fees and track carrier approval.",
      },
      { property: "og:title", content: "A2P Registration · EST8 CallDesk" },
      {
        property: "og:description",
        content:
          "Secure business registration, messaging consent review and phone-number compliance status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: A2pRegistration,
});
