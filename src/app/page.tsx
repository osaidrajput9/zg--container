import { Hero } from "@/components/hero";
import { ScrollReveal } from "@/components/scroll-reveal";

export default function Home() {
  return (
    <main className="flex-1">
      <Hero />
      <ScrollReveal />
    </main>
  );
}
