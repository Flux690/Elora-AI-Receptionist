import RequestItem from "./RequestItem";

function RequestList({ title, requests, onResolve, listType }) {
  const titleId = title.toLowerCase().replace(" ", "-");
  const listClassName = `request-list ${listType || ""}`;

  return (
    <section className={listClassName} aria-labelledby={titleId}>
      <h2 id={titleId} className="section-heading">
        {title}
      </h2>

      <div className="request-list-items">
        {requests.length === 0 ? (
          <p>No requests found.</p>
        ) : (
          requests.map((req) => (
            <RequestItem key={req.id} request={req} onResolve={onResolve} />
          ))
        )}
      </div>
    </section>
  );
}

export default RequestList;
