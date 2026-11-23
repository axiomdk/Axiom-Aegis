import { DistanceEntry, TimelineEntry, DistanceUnit, DistanceActivityType } from '../types';

export interface StandardizedTimelineEntry {
  id: string;
  type: 'place_visit' | 'activity' | 'transit' | 'setting_event';
  startTime: string; // ISO 8601 formatted string (e.g. 2026-10-21T18:25:57.633Z)
  endTime: string;   // ISO 8601 formatted string
  title: string;     // Name of location, venue, activity, or device event
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  details: {
    transportMode?: string;
    distanceMeters?: number;
    distanceMiles?: number;
    address?: string;
    device?: string;
    notes?: string;
    confidence?: string;
    rawType?: string;
    [key: string]: unknown;
  };
}

export interface ParsedTakeoutDistance {
  id: string;
  importHash: string;
  date: string; // YYYY-MM-DD
  distance: number;
  unit: DistanceUnit;
  type: DistanceActivityType;
  description: string;
  isDuplicate: boolean;
  selected: boolean;
  rawDurationMinutes?: number;
}

export interface ParsedTakeoutTimeline {
  id: string;
  importHash: string;
  title: string;
  category: 'health' | 'work' | 'personal' | 'social' | 'learning' | 'other';
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number;
  notes: string;
  isDuplicate: boolean;
  selected: boolean;
}

export interface TakeoutParseResult {
  distances: ParsedTakeoutDistance[];
  timeline: ParsedTakeoutTimeline[];
  standardizedEntries: StandardizedTimelineEntry[];
  totalDistanceFound: number;
  totalTimelineFound: number;
  duplicateDistances: number;
  duplicateTimeline: number;
  sourceFormat: 'semantic_timeline' | 'records' | 'settings_metadata' | 'custom_array' | 'unknown';
  metadataNote?: string;
}

export function mapTakeoutActivityType(rawType: string): DistanceActivityType {
  const t = (rawType || '').toUpperCase();
  if (t.includes('RUN') || t.includes('JOG')) return 'run';
  if (t.includes('CYCL') || t.includes('BIKE')) return 'cycle';
  if (t.includes('WALK') || t.includes('FOOT') || t.includes('HIKE') || t.includes('PEDESTRIAN')) return 'walk';
  if (t.includes('VEHICLE') || t.includes('DRIV') || t.includes('MOTOR') || t.includes('CAR') || t.includes('AUTOMOBILE') || t.includes('BUS') || t.includes('TRAIN')) return 'drive';
  if (t.includes('FLY') || t.includes('AIR') || t.includes('PLANE') || t.includes('FLIGHT')) return 'flight';
  return 'other';
}

function mapCategoryFromActivity(type: DistanceActivityType): 'health' | 'personal' | 'work' | 'other' {
  if (type === 'run' || type === 'cycle' || type === 'walk') return 'health';
  if (type === 'drive') return 'other';
  return 'personal';
}

function metersToUnit(meters: number, unit: DistanceUnit): number {
  if (unit === 'mi') {
    return Math.round(meters * 0.000621371 * 100) / 100;
  }
  return Math.round(meters * 0.001 * 100) / 100;
}

function parseIsoTimestamp(isoOrMs: string | number): { date: string; time: string; timestampMs: number; isoString: string } | null {
  try {
    const d = new Date(isoOrMs);
    if (isNaN(d.getTime())) return null;

    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return { date, time, timestampMs: d.getTime(), isoString: d.toISOString() };
  } catch {
    return null;
  }
}

function generateHash(prefix: string, parts: string[]): string {
  const rawKey = parts.join('|').toLowerCase().replace(/[^a-z0-9|]/g, '');
  let hash = 0x811c9dc5;
  for (let i = 0; i < rawKey.length; i++) {
    hash ^= rawKey.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${prefix}-${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

export function parseGoogleTakeoutJson(
  jsonText: string,
  preferredUnit: DistanceUnit = 'mi',
  existingDistances: DistanceEntry[] = [],
  existingTimeline: TimelineEntry[] = []
): TakeoutParseResult {
  let parsedJson: any;
  try {
    parsedJson = JSON.parse(jsonText, (key, value) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return undefined;
      }
      if (typeof value === 'string') {
        return value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<\/?[a-zA-Z][^>]*>/g, '');
      }
      return value;
    });
  } catch {
    throw new Error('Invalid JSON format: Could not parse file contents.');
  }

  const existingDistHashes = new Set<string>();
  for (const d of existingDistances) {
    if (d.importHash) existingDistHashes.add(d.importHash);
    existingDistHashes.add(generateHash('dist', [d.date, d.type, String(Math.round(d.distance * 10))]));
  }

  const existingTimeHashes = new Set<string>();
  for (const t of existingTimeline) {
    if (t.importHash) existingTimeHashes.add(t.importHash);
    existingTimeHashes.add(generateHash('time', [t.date, t.startTime, t.endTime, t.title]));
  }

  const distances: ParsedTakeoutDistance[] = [];
  const timeline: ParsedTakeoutTimeline[] = [];
  const standardizedEntries: StandardizedTimelineEntry[] = [];

  let duplicateDistances = 0;
  let duplicateTimeline = 0;
  let sourceFormat: TakeoutParseResult['sourceFormat'] = 'unknown';
  let metadataNote: string | undefined;

  // --------------------------------------------------------------------------
  // 1. Google Takeout Settings / Device Audit Export (Settings.json)
  // --------------------------------------------------------------------------
  if (parsedJson && (parsedJson.deviceSettings || parsedJson.encryptedBackupsControls || parsedJson.historyEnabled !== undefined)) {
    sourceFormat = 'settings_metadata';
    metadataNote = 'Google Takeout Timeline Settings & Audit file detected. Note: Your mobile device has end-to-end encrypted timeline backups enabled on Google servers. To export unencrypted daily coordinates and place visits: In Google Maps on your phone, go to Your Timeline > Settings > Export Timeline Data.';

    // 1a. Device Activity Events
    if (Array.isArray(parsedJson.deviceSettings)) {
      parsedJson.deviceSettings.forEach((dev: any, idx: number) => {
        const deviceName = dev.devicePrettyName || `Android Device (Tag ${dev.deviceTag})`;
        const lastReq = dev.lastRequestTime ? parseIsoTimestamp(dev.lastRequestTime) : null;
        const creation = dev.deviceCreationTime ? parseIsoTimestamp(dev.deviceCreationTime) : null;

        if (lastReq) {
          const title = `Timeline Sync: ${deviceName}`;
          const timeHash = generateHash('time', [lastReq.date, lastReq.time, lastReq.time, title]);
          const isDup = existingTimeHashes.has(timeHash);
          if (isDup) duplicateTimeline++;
          else existingTimeHashes.add(timeHash);

          timeline.push({
            id: `to-dev-${idx}-${lastReq.timestampMs}`,
            importHash: timeHash,
            title,
            category: 'personal',
            date: lastReq.date,
            startTime: lastReq.time,
            endTime: lastReq.time,
            durationMinutes: 15,
            notes: `Device ${deviceName} (OS ${dev.androidOsLevel || '36'}). Active place visits recorded for past 7 days.`,
            isDuplicate: isDup,
            selected: !isDup,
          });

          standardizedEntries.push({
            id: `std-dev-${idx}-${lastReq.timestampMs}`,
            type: 'setting_event',
            startTime: lastReq.isoString,
            endTime: lastReq.isoString,
            title,
            details: {
              device: deviceName,
              platform: dev.platformType || 'ANDROID',
              androidOsLevel: dev.androidOsLevel,
              notes: 'Active device with saved timeline data. Observed place visits for 30% of the last 7 days.',
            },
          });
        }

        if (creation) {
          standardizedEntries.push({
            id: `std-dev-create-${idx}`,
            type: 'setting_event',
            startTime: creation.isoString,
            endTime: creation.isoString,
            title: `Device Enrolled: ${deviceName}`,
            details: {
              device: deviceName,
              notes: 'Device registration and timeline activation date.',
            },
          });
        }
      });
    }

    // 1b. Encrypted Backup Events
    if (parsedJson.encryptedBackupsControls) {
      for (const [tag, val] of Object.entries<any>(parsedJson.encryptedBackupsControls)) {
        if (val && val.updateTime) {
          const parsed = parseIsoTimestamp(val.updateTime);
          if (parsed) {
            standardizedEntries.push({
              id: `std-enc-backup-${tag}`,
              type: 'setting_event',
              startTime: parsed.isoString,
              endTime: parsed.isoString,
              title: `Encrypted Cloud Backup Enabled`,
              details: {
                deviceTag: tag,
                backupStatus: val.enabled ? 'Active' : 'Disabled',
                notes: 'Timeline backups end-to-end encrypted with device key on Google servers.',
              },
            });
          }
        }
      }
    }

    // 1c. Retention policy event
    if (parsedJson.createdTime) {
      const created = parseIsoTimestamp(parsedJson.createdTime);
      if (created) {
        standardizedEntries.push({
          id: `std-timeline-origin`,
          type: 'setting_event',
          startTime: created.isoString,
          endTime: created.isoString,
          title: `Timeline Account Created`,
          details: {
            notes: 'Initial activation of Google Location History timeline.',
          },
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // 2. Semantic Location History: { timelineObjects: [ { activitySegment }, { placeVisit } ] }
  // --------------------------------------------------------------------------
  else if (parsedJson && Array.isArray(parsedJson.timelineObjects)) {
    sourceFormat = 'semantic_timeline';
    const objects = parsedJson.timelineObjects;

    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];

      // ACTIVITY SEGMENT (Movement / Distance / Workout / Transit)
      if (obj.activitySegment) {
        const seg = obj.activitySegment;
        const startRaw = seg.duration?.startTimestamp || seg.duration?.startTimestampMs;
        const endRaw = seg.duration?.endTimestamp || seg.duration?.endTimestampMs;

        const startParsed = startRaw ? parseIsoTimestamp(startRaw) : null;
        const endParsed = endRaw ? parseIsoTimestamp(endRaw) : null;

        if (startParsed) {
          const rawActType = seg.activityType || seg.activities?.[0]?.activityType || 'WALKING';
          const actType = mapTakeoutActivityType(rawActType);
          const meters = Number(seg.distance || 0);
          const distAmount = meters > 0 ? metersToUnit(meters, preferredUnit) : 0;
          const distMiles = meters > 0 ? metersToUnit(meters, 'mi') : 0;
          const durationMins =
            startParsed && endParsed
              ? Math.max(1, Math.round((endParsed.timestampMs - startParsed.timestampMs) / 60000))
              : 30;

          // If distance exists, create Distance Entry
          if (distAmount > 0) {
            const distHash = generateHash('dist', [
              startParsed.date,
              actType,
              String(Math.round(distAmount * 10)),
            ]);
            const isDup = existingDistHashes.has(distHash);
            if (isDup) duplicateDistances++;
            else existingDistHashes.add(distHash);

            distances.push({
              id: `to-d-${Date.now()}-${i}`,
              importHash: distHash,
              date: startParsed.date,
              distance: distAmount,
              unit: preferredUnit,
              type: actType,
              description: `Takeout ${actType.toUpperCase()}: ${distAmount} ${preferredUnit} (${durationMins}m)`,
              isDuplicate: isDup,
              selected: !isDup,
              rawDurationMinutes: durationMins,
            });
          }

          // Create Timeline Entry for the activity
          const endTimeStr = endParsed ? endParsed.time : startParsed.time;
          const actTitle = `Takeout ${actType.charAt(0).toUpperCase() + actType.slice(1)} Session`;
          const timeHash = generateHash('time', [startParsed.date, startParsed.time, endTimeStr, actTitle]);
          const isTimeDup = existingTimeHashes.has(timeHash);
          if (isTimeDup) duplicateTimeline++;
          else existingTimeHashes.add(timeHash);

          timeline.push({
            id: `to-t-${Date.now()}-${i}`,
            importHash: timeHash,
            title: actTitle,
            category: mapCategoryFromActivity(actType),
            date: startParsed.date,
            startTime: startParsed.time,
            endTime: endTimeStr,
            durationMinutes: durationMins,
            notes: `Extracted from Google Takeout Semantic History. ${distAmount > 0 ? `Distance: ${distAmount} ${preferredUnit}.` : ''}`,
            isDuplicate: isTimeDup,
            selected: !isTimeDup,
          });

          // Coordinates from startLocation or endLocation if available
          let coords: { latitude: number; longitude: number } | undefined;
          const loc = seg.startLocation || seg.endLocation;
          if (loc) {
            const lat = (loc.latitudeE7 ?? loc.latE7) ? (loc.latitudeE7 ?? loc.latE7) / 1e7 : loc.latitude ?? loc.lat;
            const lng = (loc.longitudeE7 ?? loc.lngE7) ? (loc.longitudeE7 ?? loc.lngE7) / 1e7 : loc.longitude ?? loc.lng;
            if (typeof lat === 'number' && typeof lng === 'number') {
              coords = { latitude: lat, longitude: lng };
            }
          }

          const isTransit = actType === 'drive' || actType === 'flight' || rawActType.includes('TRANSIT') || rawActType.includes('BUS') || rawActType.includes('TRAIN');
          standardizedEntries.push({
            id: `std-act-${Date.now()}-${i}`,
            type: isTransit ? 'transit' : 'activity',
            startTime: startParsed.isoString,
            endTime: endParsed ? endParsed.isoString : startParsed.isoString,
            title: actTitle,
            coordinates: coords,
            details: {
              transportMode: actType,
              rawType: rawActType,
              distanceMeters: meters,
              distanceMiles: distMiles,
              durationMinutes: durationMins,
              confidence: seg.confidence,
            },
          });
        }
      }

      // PLACE VISIT (Locations / Places visited)
      if (obj.placeVisit) {
        const pv = obj.placeVisit;
        const startRaw = pv.duration?.startTimestamp || pv.duration?.startTimestampMs;
        const endRaw = pv.duration?.endTimestamp || pv.duration?.endTimestampMs;

        const startParsed = startRaw ? parseIsoTimestamp(startRaw) : null;
        const endParsed = endRaw ? parseIsoTimestamp(endRaw) : null;

        if (startParsed) {
          const placeName = pv.location?.name || pv.location?.address || 'Visited Location';
          const title = `Visit: ${placeName.split(',')[0].slice(0, 40)}`;
          const durationMins =
            startParsed && endParsed
              ? Math.max(1, Math.round((endParsed.timestampMs - startParsed.timestampMs) / 60000))
              : 30;
          const endTimeStr = endParsed ? endParsed.time : startParsed.time;

          const timeHash = generateHash('time', [startParsed.date, startParsed.time, endTimeStr, title]);
          const isTimeDup = existingTimeHashes.has(timeHash);
          if (isTimeDup) duplicateTimeline++;
          else existingTimeHashes.add(timeHash);

          timeline.push({
            id: `to-t-pv-${Date.now()}-${i}`,
            importHash: timeHash,
            title,
            category: 'personal',
            date: startParsed.date,
            startTime: startParsed.time,
            endTime: endTimeStr,
            durationMinutes: durationMins,
            notes: `Google Takeout Place Visit. Address: ${pv.location?.address || 'Local Coordinates'}.`,
            isDuplicate: isTimeDup,
            selected: !isTimeDup,
          });

          let coords: { latitude: number; longitude: number } | undefined;
          if (pv.location) {
            const loc = pv.location;
            const lat = (loc.latitudeE7 ?? loc.latE7) ? (loc.latitudeE7 ?? loc.latE7) / 1e7 : loc.latitude ?? loc.lat;
            const lng = (loc.longitudeE7 ?? loc.lngE7) ? (loc.longitudeE7 ?? loc.lngE7) / 1e7 : loc.longitude ?? loc.lng;
            if (typeof lat === 'number' && typeof lng === 'number') {
              coords = { latitude: lat, longitude: lng };
            }
          }

          standardizedEntries.push({
            id: `std-pv-${Date.now()}-${i}`,
            type: 'place_visit',
            startTime: startParsed.isoString,
            endTime: endParsed ? endParsed.isoString : startParsed.isoString,
            title: placeName,
            coordinates: coords,
            details: {
              address: pv.location?.address,
              placeId: pv.location?.placeId,
              confidence: pv.confidence,
              durationMinutes: durationMins,
            },
          });
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 3. Custom JSON Array or Object: [ { date, distance, type } ] or { distances: [ ... ] }
  // --------------------------------------------------------------------------
  else if (
    Array.isArray(parsedJson) ||
    (parsedJson && (Array.isArray(parsedJson.distances) || Array.isArray(parsedJson.timeline) || Array.isArray(parsedJson.distanceLogs)))
  ) {
    sourceFormat = 'custom_array';
    const items: any[] = Array.isArray(parsedJson)
      ? parsedJson
      : [...(parsedJson.distances || parsedJson.distanceLogs || []), ...(parsedJson.timeline || [])];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;
      const date = item.date || item.timestamp?.slice(0, 10);
      if (!date) continue;

      if (item.distance !== undefined && item.distance > 0) {
        const distNum = Number(item.distance);
        const actType = mapTakeoutActivityType(item.type || item.activity || 'run');
        const distHash = generateHash('dist', [date, actType, String(Math.round(distNum * 10))]);
        const isDup = existingDistHashes.has(distHash);
        if (isDup) duplicateDistances++;
        else existingDistHashes.add(distHash);

        distances.push({
          id: `to-arr-d-${Date.now()}-${i}`,
          importHash: distHash,
          date,
          distance: distNum,
          unit: item.unit || preferredUnit,
          type: actType,
          description: item.description || item.title || `Imported ${actType}: ${distNum} ${preferredUnit}`,
          isDuplicate: isDup,
          selected: !isDup,
        });
      }

      if (item.startTime && item.endTime) {
        const title = item.title || item.name || 'Imported Activity';
        const timeHash = generateHash('time', [date, item.startTime, item.endTime, title]);
        const isTimeDup = existingTimeHashes.has(timeHash);
        if (isTimeDup) duplicateTimeline++;
        else existingTimeHashes.add(timeHash);

        timeline.push({
          id: `to-arr-t-${Date.now()}-${i}`,
          importHash: timeHash,
          title,
          category: item.category || 'health',
          date,
          startTime: item.startTime,
          endTime: item.endTime,
          durationMinutes: Number(item.durationMinutes) || 30,
          notes: item.notes || 'Imported from activity JSON.',
          isDuplicate: isTimeDup,
          selected: !isTimeDup,
        });

        const startIso = item.startTime.includes('T') ? item.startTime : `${date}T${item.startTime}:00.000Z`;
        const endIso = item.endTime.includes('T') ? item.endTime : `${date}T${item.endTime}:00.000Z`;

        standardizedEntries.push({
          id: `std-arr-${Date.now()}-${i}`,
          type: item.type === 'place_visit' ? 'place_visit' : 'activity',
          startTime: startIso,
          endTime: endIso,
          title,
          coordinates: item.coordinates || (item.latitude && item.longitude ? { latitude: item.latitude, longitude: item.longitude } : undefined),
          details: {
            notes: item.notes,
            transportMode: item.type,
          },
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // 4. Raw Location History Records: { locations: [ ... ] }
  // --------------------------------------------------------------------------
  else if (parsedJson && Array.isArray(parsedJson.locations)) {
    sourceFormat = 'records';
    const locs = parsedJson.locations;
    for (let i = 0; i < Math.min(locs.length, 500); i++) {
      const loc = locs[i];
      const parsedTime = parseIsoTimestamp(loc.timestamp || loc.timestampMs);
      if (parsedTime) {
        const lat = (loc.latitudeE7 ?? loc.latE7) / 1e7;
        const lng = (loc.longitudeE7 ?? loc.lngE7) / 1e7;
        const title = `Location Fix: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;

        standardizedEntries.push({
          id: `std-rec-${i}`,
          type: 'activity',
          startTime: parsedTime.isoString,
          endTime: parsedTime.isoString,
          title,
          coordinates: { latitude: lat, longitude: lng },
          details: {
            accuracy: loc.accuracy,
            altitude: loc.altitude,
            notes: 'Raw GPS trackpoint from Google Takeout records.',
          },
        });
      }
    }
  }

  return {
    distances,
    timeline,
    standardizedEntries,
    totalDistanceFound: distances.length,
    totalTimelineFound: timeline.length,
    duplicateDistances,
    duplicateTimeline,
    sourceFormat,
    metadataNote,
  };
}

export function exportStandardizedTakeoutJson(entries: StandardizedTimelineEntry[]): string {
  return JSON.stringify(entries, null, 2);
}
