import { cookies } from 'next/headers';
import { getData } from './lib/db';
import MascotScrollytelling from '../components/MascotScrollytelling';

export default async function Home() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('session')?.value;
  
  let user = null;
  if (sessionId) {
    try {
      const data = getData();
      const found = data.users.find(u => u.id === sessionId);
      if (found) {
        user = { id: found.id, name: found.name, email: found.email };
      }
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div style={{ backgroundColor: '#e5e5e5', minHeight: '100vh' }}>
      <MascotScrollytelling user={user} />
    </div>
  );
}
