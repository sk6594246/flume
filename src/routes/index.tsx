import { createFileRoute } from "@tanstack/react-router";
import { Studio } from "@/components/flume/studio";

export const Route = createFileRoute("/")({
  component: Studio,
});
