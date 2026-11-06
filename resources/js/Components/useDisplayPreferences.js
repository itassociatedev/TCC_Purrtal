import {useSyncExternalStore} from 'react';
import {getDisplayPreferences,subscribeDisplayPreferences,setDisplayPreferences} from '@/Utils/displayPreferences.mjs';
export default function useDisplayPreferences(){return [useSyncExternalStore(subscribeDisplayPreferences,getDisplayPreferences,getDisplayPreferences),setDisplayPreferences];}
