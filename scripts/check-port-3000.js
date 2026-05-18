async function main() {
  console.log("Checking http://localhost:3000/v1/blog ...");
  try {
    const res = await fetch("http://localhost:3000/v1/blog");
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Length:", text.length);
    console.log("Snippet:", text.slice(0, 1000));
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}
main();
