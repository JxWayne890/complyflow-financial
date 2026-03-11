const cleanText = `# Title
Here is some text.
## Section 1
Paragraph 1.

Paragraph 2.`

const blocks = cleanText.split("\n\n").map((block) => {
  const trimmed = block.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("###")) return `<h3 style="margin-top: 32px; margin-bottom: 16px; font-weight: 700;">${trimmed.replace(/^###\s*/, "").replace(/\*\*/g, "")}</h3>`;
  if (trimmed.startsWith("##")) return `<h2 style="margin-top: 40px; margin-bottom: 20px; font-weight: 700;">${trimmed.replace(/^##\s*/, "").replace(/\*\*/g, "")}</h2>`;
  if (trimmed.startsWith("#")) return `<h1 style="margin-top: 48px; margin-bottom: 24px; font-weight: 800;">${trimmed.replace(/^#\s*/, "").replace(/\*\*/g, "")}</h1>`;
  return `<p style="margin-bottom: 24px;">${trimmed.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")}</p>`;
}).filter((b) => b !== "").join("\n");

console.log(blocks);
