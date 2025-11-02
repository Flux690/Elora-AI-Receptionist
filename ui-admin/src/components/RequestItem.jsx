import { useState } from "react";
import { resolveRequest } from "../services/apiClient";

function RequestItem({ request, onResolve }) {
  const [answer, setAnswer] = useState("");
  const answerInputId = `answer-${request.id}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!answer) {
      alert("Please provide an answer.");
      return;
    }

    try {
      await resolveRequest(request.id, answer);
      alert("Request resolved!");
      onResolve();
    } catch (error) {
      console.error("Failed to resolve request:", error);
    }
  };

  return (
    <article className="request-item">
      <header>
        <p>
          <strong>Caller Phone:</strong> {request.customerPhone}
        </p>
        <p>
          <strong>Question:</strong> {request.question}
        </p>
        {request.status !== "Resolved" && (
          <p>
            <strong>Status:</strong> {request.status}
          </p>
        )}
      </header>

      {request.status === "Resolved" && (
        <p>
          <strong>Answer:</strong> {request.answer}
        </p>
      )}

      {request.status === "Pending" && (
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor={answerInputId}>Your Answer:</label>
            <textarea
              id={answerInputId}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer here..."
            />
          </div>
          <button type="submit">Resolve</button>
        </form>
      )}
    </article>
  );
}

export default RequestItem;
