import { translateSectionCopy } from '../i18n/sectionCopy';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, CalendarDays, Radio, Newspaper, ShieldCheck, MapPin, Trophy, Users, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import NationwideChatRail from '../components/schachTreff/NationwideChatRail';
import './RegionOverview.css';
import { useLanguage } from '../context/LanguageContext';
const regionText: Record<string,Record<'en'|'de'|'az'|'tr'|'ua'|'ru',string>> = {
"Turniere": { en:"Tournaments", de:"Turniere", az:"Turnirlər", tr:"Turnuvalar", ua:"Турніри", ru:"Турниры" },
"Ligen": { en:"Leagues", de:"Ligen", az:"Liqalar", tr:"Ligler", ua:"Ліги", ru:"Лиги" },
"Vereine": { en:"Clubs", de:"Vereine", az:"Klublar", tr:"Kulüpler", ua:"Клуби", ru:"Клубы" },
"Nachrichten": { en:"News", de:"Nachrichten", az:"Xəbərlər", tr:"Haberler", ua:"Новини", ru:"Новости" },
"Live-Übertragungen": { en:"Live broadcasts", de:"Live-Übertragungen", az:"Canlı yayımlar", tr:"Canlı yayınlar", ua:"Прямі трансляції", ru:"Прямые трансляции" },
"Details ansehen": { en:"View details", de:"Details ansehen", az:"Ətraflı bax", tr:"Detayları gör", ua:"Докладніше", ru:"Подробнее" },
"Termine werden geladen …": { en:"Loadin���q�^