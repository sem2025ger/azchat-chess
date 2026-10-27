import { Link } from 'react-router-dom';
export default function VorbereitungLink({username,onClick}:{username?:string|null;onClick?:()=>void}){
 if(import.meta.env.VITE_VORBEREITUNG_ENABLED!=='true')return null;
 return <Link className="inline-block rounded-lg border border-amber-300/40 px-3 py-2 text-amber-200" to="/vorbereitung" state={username?{lichessUsername:username}:undefined} onClick={onClick}>Vorbereitung</Link>;
}
