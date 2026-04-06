// Lightweight inline markdown renderer for chat responses

function parseBold(text) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((p, i) =>
    i % 2 === 1
      ? <strong key={i} style={{ color: "#e2e8f0", fontWeight: 700 }}>{p}</strong>
      : p
  );
}

function MdLine({ line, idx }) {
  if (line.startsWith("### "))
    return <div key={idx} style={{ color: "#f0b429", fontSize: 15, fontWeight: 700, marginTop: 10, marginBottom: 2, letterSpacing: 1 }}>{line.slice(4)}</div>;
  if (line.startsWith("## "))
    return <div key={idx} style={{ color: "#f0b429", fontSize: 16, fontWeight: 700, marginTop: 12, marginBottom: 3, letterSpacing: 1 }}>{line.slice(3)}</div>;
  if (line.startsWith("# "))
    return <div key={idx} style={{ color: "#f0b429", fontSize: 18, fontWeight: 700, marginTop: 12, marginBottom: 4, letterSpacing: 2 }}>{line.slice(2)}</div>;
  if (line.startsWith("- ") || line.startsWith("* "))
    return <div key={idx} style={{ paddingLeft: 12, marginBottom: 2 }}>· {parseBold(line.slice(2))}</div>;
  if (/^\d+\.\s/.test(line))
    return <div key={idx} style={{ paddingLeft: 12, marginBottom: 2 }}>{parseBold(line)}</div>;
  if (line.trim() === "---" || line.trim() === "___")
    return <hr key={idx} style={{ border: "none", borderTop: "1px solid #1e3a5f", margin: "8px 0" }} />;
  if (line.trim() === "")
    return <div key={idx} style={{ height: 6 }} />;
  return <div key={idx}>{parseBold(line)}</div>;
}

export function renderMarkdown(text) {
  return text.split("\n").map((line, i) => <MdLine key={i} line={line} idx={i} />);
}
