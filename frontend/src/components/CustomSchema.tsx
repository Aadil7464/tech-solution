import JsonLd from "./JsonLd";
export default function CustomSchema({ json }: { json?: string }) {
  if (!json) return null;
  try {
    return <JsonLd data={JSON.parse(json)} />;
  } catch {
    return null;
  }
}
