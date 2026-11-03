/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

// Connection check
if (typeof window !== 'undefined') {
  getDocFromServer(doc(db, 'test', 'connection')).catch((err) => {
    if (err instanceof Error && err.message.includes('offline')) {
      console.warn('Firebase Firestore is offline or connecting.');
    }
  });
}

export default app;
