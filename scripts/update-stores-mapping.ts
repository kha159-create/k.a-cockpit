// Script to update stores mapping from orange-dashboard format
// This creates/updates stores in Firestore with the correct store_id (4-digit) and names

// Store mapping from orange-dashboard (based on the image)
// Format: store_id (4-digit) -> store_name
const STORE_MAPPING: { [key: string]: string } = {
  // First block (1001-1012)
  '1001': '04-Andalos Mall',
  '1002': '05-Madina Center',
  '1003': '06-Haifa Mall',
  '1004': '07-Al-Salam Mall',
  '1005': '08-Al_Khayyat Center',
  '1006': '09-Riyadh Othaim Mall',
  '1007': '10-Makkah Mall',
  '1008': '11-Alia Mall Madinah',
  '1009': '12-Dhahran Mall khobar',
  '1010': '13-Red Sea Mall',
  '1011': '14-Al Nakheel Mall Riyadh',
  '1012': '15-Al-Noor Mall Madinah',
  // PLATFORMS
  '1013': 'PLATFORMS',
  // Second block (1101+)
  '1101': '12-Al_Hamra Mall',
  '1102': '13-Hayfa Mall',
  '1103': '14-Al Salam Mall',
  '1104': '15-Al Khayyat Center',
  '1105': '16-Riyadh Othaim Mall',
  '1106': '17-Makkah Mall',
  '1107': '18-Alia Mall Madinah',
  '1108': '19-Dhahran Mall khobar',
  '1109': '20-Red Sea Mall',
  '1110': '21-Al Nakheel Mall Riyadh',
  '1111': '22-Al-Noor Mall Madinah',
  '1112': '23-Abha Al_Rashid Mall New',
  '1113': '24-Al_Riyadh Park',
  // Continue with other blocks...
  '1201': '...', // Add more based on image
  '1301': '...',
  '1401': '...',
  '1501': '...',
  '1601': '...',
  '1701': '...',
  '1801': '...',
  '1901': '...',
  '2001': '...',
  '2101': '...',
  '2201': '...',
  '2301': '...',
  '2401': '...',
};

// Note: This is a template. You need to fill in the complete mapping from the image.
// Or we can create an API endpoint to update stores in Firestore.

export { STORE_MAPPING };
