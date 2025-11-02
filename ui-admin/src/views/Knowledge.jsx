import { useState, useEffect } from "react";
import { getKnowledgeBase } from "../services/apiClient";

function Knowledge() {
  const [knowledge, setKnowledge] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getKnowledgeBase();
        setKnowledge(res.data);
      } catch (error) {
        console.error("Failed to fetch knowledge base:", error);
      }
    };
    fetchData();
  }, []);

  return (
    <section aria-labelledby="knowledge-title">
      <h1 id="knowledge-title" className="page-title">
        Knowledge Base
      </h1>

      <p className="page-subtitle">
        This is a list of all questions that have been "Resolved".
      </p>

      <div>
        {knowledge.map((item) => (
          <article key={item.id} className="knowledge-item">
            <p>
              <strong>Question:</strong> {item.question}
            </p>
            <p>
              <strong>Answer:</strong> {item.answer}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default Knowledge;
