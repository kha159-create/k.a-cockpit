// Firebase fully removed - using PostgreSQL
export const firebaseConfig = {};
export const auth = {} as any;
export const db = {
  collection: () => ({
    doc: () => ({ get: async () => ({ exists: false, data: () => ({}) }), set: async () => { }, update: async () => { }, delete: async () => { } }),
    where: () => ({ get: async () => ({ empty: true, docs: [] }), onSnapshot: () => () => { } }),
    onSnapshot: () => () => { }
  }),
  batch: () => ({ set: () => { }, update: () => { }, commit: async () => { } })
} as any;
export default { auth, db };
