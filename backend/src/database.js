import admin from "firebase-admin";
import config from "./config.js";

admin.initializeApp({
  credential: admin.credential.cert(config.firebase),
});

const db = admin.firestore();
const requestsCollection = db.collection("requests");
const knowledgeCollection = db.collection("knowledge");

// Fetch Recently added "Pending" requests (less than a day)
async function getPendingRequests() {
  const oneDayAgo = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() - 24 * 60 * 60 * 1000)
  );
  const snapshot = await requestsCollection
    .where("status", "==", "Pending")
    .where("createdAt", ">=", oneDayAgo)
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// Fetch "Resolved" requests
async function getResolvedRequests() {
  const snapshot = await requestsCollection
    .where("status", "==", "Resolved")
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// Fetch "Unresolved" requests (pending for more than 1 day)
async function getUnresolvedRequests() {
  const oneDayAgo = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() - 24 * 60 * 60 * 1000)
  );
  const snapshot = await requestsCollection
    .where("status", "==", "Pending")
    .where("createdAt", "<", oneDayAgo)
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// Retrieve the entire knowledge base
async function getKnowledgeBase() {
  const snapshot = await knowledgeCollection.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// Resolve a "Pending" request and store it into knowledge base
// Text the user the pending question
async function resolveRequest(id, answer) {
  const ref = requestsCollection.doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw new Error("Request not found");

  const requestData = doc.data();
  const { question, callerId } = requestData;

  await ref.update({
    status: "Resolved",
    answer,
    resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const originalQuestion = doc.data().question;
  await knowledgeCollection.add({
    question: originalQuestion,
    answer,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Simulation: Text back the caller
  console.log(`Request resolved for callerId: ${callerId}`);
  console.log(`Question: ${question}`);
  console.log(`Answer: ${answer}`);
  console.log(`Texting ${callerId}:\n"${question}\n${answer}"`);

  return { id, status: "Resolved" };
}

// Create a new "Pending" request
async function createPendingRequest(question, callerId) {
  const newReq = {
    question,
    callerId,
    status: "Pending",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  const ref = await requestsCollection.add(newReq);
  return { id: ref.id, ...newReq };
}

export default {
  getPendingRequests,
  getResolvedRequests,
  getUnresolvedRequests,
  getKnowledgeBase,
  resolveRequest,
  createPendingRequest,
};
