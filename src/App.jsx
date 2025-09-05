import { useState, useEffect } from "react";
import { jsPDF } from "jspdf";

// Hent pdfjs direkte fra CDN
import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.min.mjs";

// Fortæl pdfjs hvor worker ligger
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.worker.min.mjs`;

function App() {
  const SUPABASE_URL =
    "https://fjwpfesqfwtozaciphnc.supabase.co/functions/v1";

  const [summary, setSummary] = useState("");
  const [profile, setProfile] = useState("");
  const [kompetenceData, setKompetenceData] = useState({});
  const [goals, setGoals] = useState({});
  const [suggestion, setSuggestion] = useState("");
  const [activities, setActivities] = useState(
    JSON.parse(localStorage.getItem("activities") || "[]")
  );

  // Loading states
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);

  // Hent kompetencemål.json
  useEffect(() => {
    fetch("kompetencemal.json")
      .then((res) => res.json())
      .then((data) => setKompetenceData(data));
  }, []);

  // Gem aktiviteter i localStorage
  useEffect(() => {
    localStorage.setItem("activities", JSON.stringify(activities));
  }, [activities]);

  // Upload & parse PDF i browseren
  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoadingPdf(true);
    setSummary("");
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item) => item.str).join(" ");
        text += pageText + "\n";
      }

      setLoadingPdf(false);
      setLoadingSummary(true);

      // Send ren tekst til opsummering function
      const res = await fetch(`${SUPABASE_URL}/opsummering`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();
      setSummary(data.summary || "");
    } catch (err) {
      console.error("Fejl ved upload:", err);
      alert("Kunne ikke læse PDF");
    } finally {
      setLoadingPdf(false);
      setLoadingSummary(false);
    }
  };

  // Skift praktikprofil → vis mål
  const handleProfileChange = (e) => {
    const selected = e.target.value;
    setProfile(selected);
    setGoals(kompetenceData[selected] || {});
  };

  // Lav forslag → forslag-function
  const handleSuggestion = async () => {
    if (!summary) {
      alert("Upload først en PDF, så vi har et resumé at arbejde med.");
      return;
    }

    setLoadingSuggestion(true);
    try {
      const combinedText = `
Resumé:
${summary}

Kompetencemål:
${Array.isArray(goals["kompetencemål"])
  ? goals["kompetencemål"].join("\n")
  : goals["kompetencemål"] || ""}

Vidensmål:
${(goals["vidensmål"] || []).join("\n")}

Færdighedsmål:
${(goals["færdighedsmål"] || []).join("\n")}
`;

      const res = await fetch(`${SUPABASE_URL}/forslag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: combinedText, profile }),
      });

      const data = await res.json();
      setSuggestion(data.suggestion || "Intet forslag modtaget");
    } catch (err) {
      console.error("Fejl ved forslag:", err);
      alert("Kunne ikke generere forslag");
    } finally {
      setLoadingSuggestion(false);
    }
  };

  // Gem aktivitet (max 3)
  const saveActivity = () => {
    if (!suggestion) {
      alert("Der er intet forslag at gemme.");
      return;
    }
    if (activities.length >= 3) {
      alert("Du kan kun gemme op til 3 aktiviteter.");
      return;
    }
    setActivities([...activities, { text: suggestion, reflection: "" }]);
  };

  // Opdater refleksion
  const updateReflection = (index, value) => {
    const newActs = [...activities];
    newActs[index].reflection = value;
    setActivities(newActs);
  };

  // Slet aktivitet
  const deleteActivity = (index) => {
    const newActs = activities.filter((_, i) => i !== index);
    setActivities(newActs);
  };

  // Udskriv til PDF
  const downloadPDF = () => {
    const doc = new jsPDF();
    let y = 10;
    activities.forEach((act, idx) => {
      doc.text(`Aktivitet ${idx + 1}:`, 10, y);
      y += 10;
      doc.text(doc.splitTextToSize(act.text, 180), 10, y);
      y += 20;
      doc.text("Refleksioner:", 10, y);
      y += 10;
      doc.text(doc.splitTextToSize(act.reflection || "-", 180), 10, y);
      y += 30;
    });
    doc.save("aktiviteter.pdf");
  };

  return (
    <div style={{ display: "flex", fontFamily: "sans-serif" }}>
      {/* Venstre side */}
      <div style={{ flex: 1, padding: "20px" }}>
        <h1>Læringsassistent</h1>

        <div style={{ marginBottom: "20px", background: "#fff", padding: "15px", borderRadius: "10px" }}>
          <h2>Upload PDF</h2>
          <input type="file" accept="application/pdf" onChange={handlePdfUpload} />
          {loadingPdf && <p>📄 Indlæser PDF...</p>}
          {loadingSummary && <p>✨ Opsummerer læreplan...</p>}
        </div>

        <div style={{ marginBottom: "20px", background: "#fff", padding: "15px", borderRadius: "10px" }}>
          <h2>Mine aktiviteter (max 3)</h2>
          {activities.map((act, idx) => (
            <div key={idx} style={{ border: "1px solid #ddd", padding: "10px", marginBottom: "10px", borderRadius: "6px" }}>
              <strong>Aktivitet {idx + 1}</strong>
              <p>{act.text}</p>
              <textarea
                placeholder="Skriv dine refleksioner..."
                value={act.reflection}
                onChange={(e) => updateReflection(idx, e.target.value)}
                style={{ width: "100%", marginBottom: "10px" }}
              />
              <button onClick={() => deleteActivity(idx)}>Slet</button>
            </div>
          ))}
          <button onClick={downloadPDF}>Udskriv alle aktiviteter</button>
        </div>
      </div>

      {/* Højre side */}
      <div style={{ flex: 1, padding: "20px" }}>
        <div style={{ marginBottom: "20px", background: "#fff", padding: "15px", borderRadius: "10px" }}>
          <h2>Opsummering af læreplan</h2>
          {loadingSummary ? (
            <p>✨ GPT arbejder...</p>
          ) : (
            <div style={{
              border: "1px solid #ddd",
              padding: "12px",
              borderRadius: "6px",
              backgroundColor: "#f9f9f9",
              whiteSpace: "pre-wrap",
              wordWrap: "break-word",
              maxHeight: "300px",
              overflowY: "auto",
              fontSize: "14px",
              lineHeight: "1.4"
            }}>
              {summary || "Ingen opsummering endnu - upload en PDF for at komme i gang."}
            </div>
          )}
        </div>

        <div style={{ marginBottom: "20px", background: "#fff", padding: "15px", borderRadius: "10px" }}>
          <h2>Praktikprofil & mål</h2>
          <select value={profile} onChange={handleProfileChange}>
            <option value="">Vælg profil</option>
            {Object.keys(kompetenceData).map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
          {profile && goals && (
            <div>
              <h3>Kompetencemål</h3>
              <ul>
                {Array.isArray(goals["kompetencemål"])
                  ? goals["kompetencemål"].map((m, i) => <li key={i}>{m}</li>)
                  : <li>{goals["kompetencemål"]}</li>}
              </ul>

              <h3>Vidensmål</h3>
              <ul>{(goals["vidensmål"] || []).map((m, i) => <li key={i}>{m}</li>)}</ul>

              <h3>Færdighedsmål</h3>
              <ul>{(goals["færdighedsmål"] || []).map((m, i) => <li key={i}>{m}</li>)}</ul>
            </div>
          )}
        </div>

        <div style={{ background: "#fff", padding: "15px", borderRadius: "10px" }}>
          <h2>Lav forslag til aktivitet</h2>
          <button onClick={handleSuggestion} disabled={loadingSuggestion}>
            {loadingSuggestion ? "⏳ Genererer forslag..." : "Lav forslag"}
          </button>
          <pre>{suggestion}</pre>
          <button onClick={saveActivity}>Gem aktivitet</button>
        </div>
      </div>
    </div>
  );
}

export default App;
