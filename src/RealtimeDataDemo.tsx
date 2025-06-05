import React, { useState, useEffect, FormEvent } from 'react';
import { database } from './firebaseConfig'; // Assuming firebaseConfig.ts is in the same directory
import { ref, set, onValue, push, child, DataSnapshot } from 'firebase/database';

interface DemoDataItem {
  id: string;
  text: string;
  timestamp: number;
}

const RealtimeDataDemo: React.FC = () => {
  const [inputValue, setInputValue] = useState<string>('');
  const [data, setData] = useState<DemoDataItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const dataPath = 'demoData'; // Path in your Realtime Database

  useEffect(() => {
    const dbRef = ref(database, dataPath);

    // Listener for data changes
    const unsubscribe = onValue(dbRef, (snapshot: DataSnapshot) => {
      if (snapshot.exists()) {
        const rawData = snapshot.val();
        // Firebase returns an object when data is stored, convert to array
        const loadedData: DemoDataItem[] = Object.keys(rawData).map(key => ({
          id: key,
          ...rawData[key]
        }));
        setData(loadedData);
        setError(null);
      } else {
        setData([]);
        setError('No data available at this path.');
      }
    }, (err) => {
      console.error("Error fetching data: ", err);
      setError(`Failed to fetch data: ${err.message}`);
    });

    // Cleanup listener on component unmount
    return () => unsubscribe();
  }, []); // Empty dependency array means this effect runs once on mount and cleans up on unmount

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inputValue.trim()) {
      setError('Input cannot be empty.');
      return;
    }

    try {
      // Get a new push key for a new entry
      const newDataRef = push(child(ref(database), dataPath));
      await set(newDataRef, {
        text: inputValue.trim(),
        timestamp: Date.now(),
      });
      setInputValue(''); // Clear input field
      setError(null);
    } catch (err: any) {
      console.error("Error writing data: ", err);
      setError(`Failed to write data: ${err.message}`);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>Firebase Realtime Database Demo</h2>
      
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter data to save"
          style={{ padding: '8px', marginRight: '10px', minWidth: '200px' }}
        />
        <button type="submit" style={{ padding: '8px 15px' }}>Add Data</button>
      </form>

      <h3>Stored Data:</h3>
      {data.length > 0 ? (
        <ul style={{ listStyleType: 'none', padding: 0 }}>
          {data.map((item) => (
            <li key={item.id} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}>
              <p><strong>ID:</strong> {item.id}</p>
              <p><strong>Text:</strong> {item.text}</p>
              <p><strong>Timestamp:</strong> {new Date(item.timestamp).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>{error && error.startsWith('Failed to fetch data') ? 'Could not load data.' : 'No data yet, or path is empty.'}</p>
      )}
    </div>
  );
};

export default RealtimeDataDemo;
