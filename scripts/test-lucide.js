try {
  const lucide = require('lucide-react');
  console.log("✅ lucide-react loaded successfully!");
  console.log("BookOpen:", !!lucide.BookOpen);
  console.log("Calendar:", !!lucide.Calendar);
  console.log("Clock:", !!lucide.Clock);
  console.log("ArrowRight:", !!lucide.ArrowRight);
} catch (e) {
  console.error("❌ Error loading lucide-react:", e.message);
}
