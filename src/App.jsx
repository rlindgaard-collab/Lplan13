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
    <div style={{ 
      display: "flex", 
      flexDirection: window.innerWidth <= 768 ? "column" : "row",
      fontFamily: "sans-serif",
      minHeight: "100vh",
      backgroundColor: "#f5f5f5"
    }}>
      {/* Venstre side */}
      <div style={{ 
        flex: 1, 
        padding: window.innerWidth <= 768 ? "10px" : "20px",
        maxWidth: window.innerWidth <= 768 ? "100%" : "50%"
      }}>
        <h1>Læringsassistent</h1>

        <div style={{ 
          marginBottom: "20px", 
          background: "#fff", 
          padding: window.innerWidth <= 768 ? "10px" : "15px", 
          borderRadius: "10px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <input 
            type="file" 
            accept="application/pdf" 
            onChange={handlePdfUpload}
            style={{ display: "none" }}
            id="pdf-upload"
          />
          <label 
            htmlFor="pdf-upload"
            style={{
              display: "inline-block",
              padding: window.innerWidth <= 768 ? "12px 16px" : "10px 20px",
              backgroundColor: "#007bff",
              color: "white",
              borderRadius: "5px",
              cursor: "pointer",
              border: "none",
              fontSize: window.innerWidth <= 768 ? "14px" : "16px",
              width: window.innerWidth <= 768 ? "100%" : "auto",
              textAlign: "center"
            }}
          >
            Upload PDF
          </label>
          {loadingPdf && <p>📄 Indlæser PDF...</p>}
          {loadingSummary && <p>✨ Opsummerer læreplan...</p>}
        </div>

        <div style={{ 
          marginBottom: "20px", 
          background: "#fff", 
          padding: window.innerWidth <= 768 ? "10px" : "15px", 
          borderRadius: "10px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <h2>Mine aktiviteter (max 3)</h2>
          {activities.map((act, idx) => (
            <div key={idx} style={{ 
              border: "1px solid #ddd", 
              padding: window.innerWidth <= 768 ? "8px" : "10px", 
              marginBottom: "10px", 
              borderRadius: "6px" 
            }}>
              <strong>Aktivitet {idx + 1}</strong>
              <p>{act.text}</p>
              <textarea
                placeholder="Skriv dine refleksioner..."
                value={act.reflection}
                onChange={(e) => updateReflection(idx, e.target.value)}
                style={{ 
                  width: "100%", 
                  marginBottom: "10px",
                  minHeight: window.innerWidth <= 768 ? "60px" : "80px",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ddd"
                }}
              />
              <button 
                onClick={() => deleteActivity(idx)}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "#dc3545",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                Slet
              </button>
            </div>
          ))}
          <button 
            onClick={downloadPDF}
            style={{
              padding: window.innerWidth <= 768 ? "12px 16px" : "10px 20px",
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              width: window.innerWidth <= 768 ? "100%" : "auto",
              fontSize: window.innerWidth <= 768 ? "14px" : "16px"
            }}
          >
            Udskriv alle aktiviteter
          </button>
        </div>
      </div>

      {/* Højre side */}
      <div style={{ 
        flex: 1, 
        padding: window.innerWidth <= 768 ? "10px" : "20px",
        maxWidth: window.innerWidth <= 768 ? "100%" : "50%"
      }}>
        <div style={{ 
          marginBottom: "20px", 
          background: "#fff", 
          padding: window.innerWidth <= 768 ? "10px" : "15px", 
          borderRadius: "10px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
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
              maxHeight: window.innerWidth <= 768 ? "200px" : "300px",
              overflowY: "auto",
              fontSize: window.innerWidth <= 768 ? "12px" : "14px",
              lineHeight: "1.4"
            }}>
              {summary || "Ingen opsummering endnu - upload en PDF for at komme i gang."}
            </div>
          )}
        </div>

        <div style={{ 
          marginBottom: "20px", 
          background: "#fff", 
          padding: window.innerWidth <= 768 ? "10px" : "15px", 
          borderRadius: "10px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <h2>Praktikprofil & mål</h2>
          <select 
            value={profile} 
            onChange={handleProfileChange}
            style={{
              width: "100%",
              padding: "8px",
              marginBottom: "10px",
              borderRadius: "4px",
              border: "1px solid #ddd",
              fontSize: window.innerWidth <= 768 ? "14px" : "16px"
            }}
          >
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

        <div style={{ 
          background: "#fff", 
          padding: window.innerWidth <= 768 ? "10px" : "15px", 
          borderRadius: "10px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <h2>Lav forslag til aktivitet</h2>
          <button 
            onClick={handleSuggestion} 
            disabled={loadingSuggestion}
            style={{
              padding: window.innerWidth <= 768 ? "12px 16px" : "10px 20px",
              backgroundColor: loadingSuggestion ? "#6c757d" : "#007bff",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: loadingSuggestion ? "not-allowed" : "pointer",
              width: window.innerWidth <= 768 ? "100%" : "auto",
              fontSize: window.innerWidth <= 768 ? "14px" : "16px",
              marginBottom: "10px"
            }}
          >
            {loadingSuggestion ? "⏳ Genererer forslag..." : "Lav forslag"}
          </button>
          <div style={{
            border: "1px solid #ddd",
            padding: "12px",
            borderRadius: "6px",
            backgroundColor: "#f9f9f9",
            whiteSpace: "pre-wrap",
            wordWrap: "break-word",
            maxHeight: window.innerWidth <= 768 ? "200px" : "300px",
            overflowY: "auto",
            fontSize: window.innerWidth <= 768 ? "12px" : "14px",
            lineHeight: "1.4",
            marginTop: "10px",
            marginBottom: "10px"
          }}>
            {suggestion || "Klik på 'Lav forslag' for at få et aktivitetsforslag baseret på din læreplan og kompetencemål."}
          </div>
          <button 
            onClick={saveActivity}
            style={{
              padding: window.innerWidth <= 768 ? "12px 16px" : "10px 20px",
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              width: window.innerWidth <= 768 ? "100%" : "auto",
              fontSize: window.innerWidth <= 768 ? "14px" : "16px"
            }}
          >
            Gem aktivitet
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
