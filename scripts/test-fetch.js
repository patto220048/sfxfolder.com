async function main() {
  console.log("Fetching http://localhost:3001/v1/blog ...");
  try {
    const res = await fetch("http://localhost:3001/v1/blog");
    console.log("Status:", res.status);
    const text = await res.text();
    if (res.status !== 200) {
      console.log("Response (first 1000 chars):", text.slice(0, 1000));
    } else {
      console.log("Success! Length:", text.length);
    }
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}
main();
