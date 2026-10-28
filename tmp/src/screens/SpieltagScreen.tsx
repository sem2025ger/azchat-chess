import { translateSectionCopy } from '../i18n/sectionCopy';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { createSpieltagApi,spieltagEnabled,SpieltagError,scheduleFromMatch,boardInput,type SpieltagTeam,type SpieltagClub,type SpieltagMatch,type SpieltagBoard,type SpieltagSchedule,type SpieltagBoardInput } from '../services/spieltag';
import { createSpielerApi,type SpielerPlayer } from '../services/spieler';
import SpielerCard from '../components/spieler/SpielerCard';
import SpieltagMatchView from '../components/spieltag/SpieltagMatchView';
import { BoardForm,ScheduleForm } from '../components/spieltag/SpieltagForms';
import './SpielerScreen.css';
import './SpieltagScreen.css';
import '../styles/sections.css';

const matchdayText: Record<string,Record<string,string>> = {"Spieltag ist derzeit deaktiviert.":{"de":"Spieltag ist derzeit deaktiviert.","en":"Matchday is currently disabled.","az":"Oyun günü hazırda deaktivdir.","tr":"Maç günü şu anda devre dışı.","ua":"Ігровий день зараз вимкнено.","ru":"Игровой день пока отключён."},"Bitte melde dich erneut an.":{"de":"Bitte melde dich erneut an.","en":"Please sign in again.","az":"Yenidən daxil olun.","tr":"Lütfen yeniden giriş yapın.","ua":"Увійдіть знову.","ru":"Войдите снож��q�^