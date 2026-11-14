// src/services/sharedResearchRecords.js
//
// Command Center core spec V1.2, Amendment E V1.1 §1 — THE RESEARCH READER'S ONE QUERY. It reads the signed-in owner's
// newest research records for the hub research door: the "Research in progress" line and Continue, and the three research
// Activity rows. One Firestore query:
//
//   researchWork  where userId == uid  orderBy createdAt desc  limit 20
//
// That is the owner read of firestore.rules (the researchWork block: read when resource.data.userId == request.auth.uid)
// and the composite index (userId ASC, createdAt DESC) in firestore.indexes.json. Records of every origin come back; only
// Shared Research's are kept, filtered here in memory.
//
// BOUNDED ON PURPOSE. A player may hold more than 20 newer records of other origins. Then the hub can miss an open
// investigation and shows no research line. It never says "no research": the sheet's own "Continue your research"
// (GET ?list=open, in src/services/sharedResearchService.js, the body's alone) is the authoritative list.
//
// It writes nothing and reads nothing else. It is NOT src/services/sharedResearchService.js, which stays the body's.

import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
// SMOKE ONLY, NEVER MERGE: the research reader answers the smoke's records; nothing is read from Firestore.
import { SMOKE_RESEARCH_RECORDS } from '../smoke/hubResearchDoorSmoke';

/**
 * The origin Shared Research's records carry: api/_utils/researchRecords/model.js SHARED_RESEARCH_ORIGIN, restated here
 * because client code does not import from api/ (pinned equal by sharedResearchRecords.test.js).
 */
export const SHARED_RESEARCH_ORIGIN = 'shared_research';
/** How many of the owner's newest records the one query reads (amendment §1). */
export const RESEARCH_READ_LIMIT = 20;
/** The collection (pilot spec §3; the record model's RESEARCH_WORK_COLLECTION). */
export const RESEARCH_WORK_COLLECTION = 'researchWork';

/**
 * The owner's newest Shared Research records, newest first, each with its document id. Throws what the read throws;
 * the reader turns that into its error state.
 *
 * @param {{ uid: string }} p
 * @returns {Promise<object[]>}
 */
export async function fetchSharedResearchRecords({ uid }) {
  if (uid) return SMOKE_RESEARCH_RECORDS.map((record) => ({ ...record }));
  const snap = await getDocs(query(
    collection(db, RESEARCH_WORK_COLLECTION),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(RESEARCH_READ_LIMIT),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((record) => record.origin === SHARED_RESEARCH_ORIGIN);
}
