import { createFileRoute } from "@tanstack/react-router";
import { AgencyA2pAdmin } from "@/components/agency-a2p-admin";
export const Route = createFileRoute("/_authenticated/_desk/agency-a2p")({
  head: () => ({
    meta: [
      { title: "Agency A2P Business Profile · EST8 CallDesk" },
      {
        name: "description",
        content:
          "Administrator-managed legal sender, insurance messaging templates and agent authorization.",
      },
      { property: "og:title", content: "Agency A2P Business Profile · EST8 CallDesk" },
      {
        property: "og:description",
        content: "Verified business identity, public consent and agency registration management.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgencyA2pAdmin,
});
