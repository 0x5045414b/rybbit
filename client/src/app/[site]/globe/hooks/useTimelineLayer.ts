import BoringAvatar from "boring-avatars";
import { round } from "lodash";
import { DateTime } from "luxon";
import mapboxgl from "mapbox-gl";
import { createElement, useEffect, useRef, useState } from "react";
// @ts-ignore - React 19 has built-in types
import { renderToStaticMarkup } from "react-dom/server";
import * as CountryFlags from "country-flag-icons/react/3x2";
import {
  Monitor,
  Smartphone,
  Link,
  Eye,
  MousePointerClick,
  Search,
  ExternalLink,
  Users,
  Mail,
  HelpCircle,
  DollarSign,
  Video,
  Handshake,
  FileText,
  ShoppingCart,
  Calendar,
  Headphones,
} from "lucide-react";
import { useTimelineSessions } from "./useTimelineSessions";
import { generateName } from "../../../../components/Avatar";
import { formatShortDuration, hour12, userLocale } from "../../../../lib/dateTimeUtils";
import type { GetSessionsResponse } from "../../../../api/analytics/userSessions";
import { useTimelineStore } from "../timelineStore";
import { extractDomain, getDisplayName } from "../../../../components/Channel";

// Generate avatar SVG using boring-avatars
function generateAvatarSVG(userId: string, size: number): string {
  const avatarElement = createElement(BoringAvatar, {
    size,
    name: userId,
    variant: "beam",
    colors: ["#92A1C6", "#146A7C", "#F0AB3D", "#C271B4", "#C20D90"],
  });
  return renderToStaticMarkup(avatarElement);
}

// Render country flag to static SVG
function renderCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "";
  const FlagComponent = CountryFlags[countryCode.toUpperCase() as keyof typeof CountryFlags];
  if (!FlagComponent) return "";
  const flagElement = createElement(FlagComponent, { className: "w-4 h-3 inline-block" });
  return renderToStaticMarkup(flagElement);
}

// Render device icon based on device type
function renderDeviceIcon(deviceType: string): string {
  const type = deviceType?.toLowerCase() || "";
  const Icon = type.includes("mobile") || type.includes("tablet") ? Smartphone : Monitor;
  const iconElement = createElement(Icon, { size: 14, className: "inline-block" });
  return renderToStaticMarkup(iconElement);
}

// Get channel icon component
function getChannelIconComponent(channel: string) {
  switch (channel) {
    case "Direct":
      return Link;
    case "Organic Search":
      return Search;
    case "Referral":
      return ExternalLink;
    case "Organic Social":
      return Users;
    case "Email":
      return Mail;
    case "Unknown":
      return HelpCircle;
    case "Paid Search":
      return Search;
    case "Paid Unknown":
      return DollarSign;
    case "Paid Social":
      return Users;
    case "Display":
      return Monitor;
    case "Organic Video":
      return Video;
    case "Affiliate":
      return Handshake;
    case "Content":
      return FileText;
    case "Organic Shopping":
      return ShoppingCart;
    case "Event":
      return Calendar;
    case "Audio":
      return Headphones;
    default:
      return null;
  }
}

// Render channel icon
function renderChannelIcon(channel: string): string {
  const IconComponent = getChannelIconComponent(channel);
  if (!IconComponent) return "";
  const iconElement = createElement(IconComponent, { size: 14, className: "inline-block" });
  return renderToStaticMarkup(iconElement);
}

// Get browser icon path
function getBrowserIconPath(browser: string): string {
  const BROWSER_TO_LOGO: Record<string, string> = {
    Chrome: "Chrome.svg",
    "Mobile Chrome": "Chrome.svg",
    Firefox: "Firefox.svg",
    "Mobile Firefox": "Firefox.svg",
    Safari: "Safari.svg",
    "Mobile Safari": "Safari.svg",
    Edge: "Edge.svg",
    Opera: "Opera.svg",
    Brave: "Brave.svg",
  };
  return BROWSER_TO_LOGO[browser] ? `/browsers/${BROWSER_TO_LOGO[browser]}` : "";
}

// Get OS icon path
function getOSIconPath(os: string): string {
  const OS_TO_LOGO: Record<string, string> = {
    Windows: "Windows.svg",
    Android: "Android.svg",
    android: "Android.svg",
    Linux: "Tux.svg",
    macOS: "macOS.svg",
    iOS: "Apple.svg",
    "Chrome OS": "Chrome.svg",
  };
  return OS_TO_LOGO[os] ? `/operating-systems/${OS_TO_LOGO[os]}` : "";
}

export function useTimelineLayer({
  map,
  mapLoaded,
  mapView,
}: {
  map: React.RefObject<mapboxgl.Map | null>;
  mapLoaded: boolean;
  mapView: string;
}) {
  const { activeSessions } = useTimelineSessions();
  const { currentTime } = useTimelineStore();
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const markersMapRef = useRef<
    Map<string, { marker: mapboxgl.Marker; element: HTMLDivElement; cleanup: () => void }>
  >(new Map());
  const openTooltipSessionIdRef = useRef<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<GetSessionsResponse[number] | null>(null);

  // Close tooltip when timeline time changes
  useEffect(() => {
    if (popupRef.current && popupRef.current.isOpen()) {
      popupRef.current.remove();
      openTooltipSessionIdRef.current = null;
    }
  }, [currentTime]);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Initialize popup once
    if (!popupRef.current) {
      popupRef.current = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: "globe-tooltip",
        anchor: "top-left",
        offset: [-30, -30], // Offset to align avatar center (padding 12px + avatar 36px/2 = 30px)
      });
    }

    const markersMap = markersMapRef.current;

    // Add global click handler to close tooltip when clicking outside
    const handleMapClick = () => {
      if (popupRef.current && popupRef.current.isOpen()) {
        popupRef.current.remove();
        openTooltipSessionIdRef.current = null;
      }
    };

    if (map.current) {
      map.current.on("click", handleMapClick);
    }

    // Hide all markers if not in timeline view
    if (mapView !== "timeline") {
      markersMap.forEach(({ marker, cleanup }) => {
        cleanup(); // Remove event listeners
        marker.remove();
      });
      // Still need to return cleanup function to remove map click handler
      return () => {
        if (map.current) {
          map.current.off("click", handleMapClick);
        }
      };
    }

    // Build set of active session IDs
    const activeSessionIds = new Set(activeSessions.filter(s => s.lat && s.lon).map(s => s.session_id));

    // Remove markers for sessions that are no longer active
    const toRemove: string[] = [];
    markersMap.forEach(({ marker, cleanup }, sessionId) => {
      if (!activeSessionIds.has(sessionId)) {
        cleanup(); // Remove event listeners
        marker.remove();
        toRemove.push(sessionId);
      }
    });
    toRemove.forEach(id => markersMap.delete(id));

    // Create or update markers for active sessions
    activeSessions.forEach(session => {
      if (!map.current) return;

      const roundedLat = round(session.lat, 4);
      const roundedLon = round(session.lon, 4);
      const existing = markersMap.get(session.session_id);

      if (existing) {
        // Update existing marker position if needed
        const currentLngLat = existing.marker.getLngLat();
        if (currentLngLat.lng !== roundedLon || currentLngLat.lat !== roundedLat) {
          existing.marker.setLngLat([roundedLon, roundedLat]);
        }
        // Re-add marker if it was removed
        if (!existing.marker.getElement().isConnected) {
          existing.marker.addTo(map.current);
        }
      } else {
        // Create new marker
        const avatarContainer = document.createElement("div");
        avatarContainer.className = "timeline-avatar-marker";
        avatarContainer.style.cursor = "pointer";
        avatarContainer.style.borderRadius = "50%";
        avatarContainer.style.overflow = "hidden";
        avatarContainer.style.width = "32px";
        avatarContainer.style.height = "32px";
        avatarContainer.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";

        // Generate avatar SVG
        const avatarSVG = generateAvatarSVG(session.user_id, 32);
        avatarContainer.innerHTML = avatarSVG;

        // Create marker
        const marker = new mapboxgl.Marker({
          element: avatarContainer,
          anchor: "center",
        })
          .setLngLat([roundedLon, roundedLat])
          .addTo(map.current);

        // Add click event for tooltip
        const toggleTooltip = (e: MouseEvent) => {
          e.stopPropagation();
          if (!map.current || !popupRef.current) return;

          // If clicking the same marker that has the tooltip open, close it
          if (popupRef.current.isOpen() && openTooltipSessionIdRef.current === session.session_id) {
            popupRef.current.remove();
            openTooltipSessionIdRef.current = null;
            return;
          }

          // If clicking a different marker (or no tooltip is open), show this one
          if (popupRef.current.isOpen()) {
            popupRef.current.remove();
          }

          const avatarSVG = generateAvatarSVG(session.user_id, 36);
          const countryCode = session.country?.length === 2 ? session.country : "";
          const flagSVG = renderCountryFlag(countryCode);
          const deviceIconSVG = renderDeviceIcon(session.device_type || "");
          const browserIconPath = getBrowserIconPath(session.browser || "");
          const osIconPath = getOSIconPath(session.operating_system || "");

          // Duration formatting
          const durationDisplay = formatShortDuration(session.session_duration || 0);

          // Start time formatting
          const startTime = DateTime.fromSQL(session.session_start, { zone: "utc" })
            .setLocale(userLocale)
            .toLocal()
            .toFormat(hour12 ? "MMM d, h:mm a" : "dd MMM, HH:mm");

          // Pageview and event icons
          const pageviewIconSVG = renderToStaticMarkup(
            createElement(Eye, { size: 14, className: "inline-block text-blue-400" })
          );
          const eventIconSVG = renderToStaticMarkup(
            createElement(MousePointerClick, { size: 14, className: "inline-block text-amber-400" })
          );

          // Referrer/Channel display
          const domain = extractDomain(session.referrer);
          let referrerIconSVG = "";
          let referrerText = "";

          if (domain) {
            referrerText = getDisplayName(domain);
            referrerIconSVG = renderChannelIcon(session.channel);
          } else {
            referrerText = session.channel;
            referrerIconSVG = renderChannelIcon(session.channel);
          }

          const name = generateName(session.user_id);

          const html = `
              <div class="flex flex-col gap-3 p-3 bg-neutral-850 border border-neutral-750 rounded-lg">
                <div class="flex items-start gap-2.5">
                  <div class="flex-shrink-0 w-9 h-9 rounded-full overflow-hidden">
                    ${avatarSVG}
                  </div>
                  <div class="flex-1 min-w-0">
                    <h3 class="text-sm font-semibold text-white truncate">${name}</h3>
                    <div class="flex items-center gap-1 text-xs text-neutral-300 mt-0.5">
                      ${flagSVG}
                      <span>${session.city || "Unknown"}, ${session.country || "Unknown"}</span>
                    </div>
                  </div>
                </div>
                <div class="flex flex-wrap items-center gap-1.5">
                  ${browserIconPath ? `<img src="${browserIconPath}" alt="${session.browser}" title="${session.browser}" class="w-4 h-4" />` : ""}
                  ${osIconPath ? `<img src="${osIconPath}" alt="${session.operating_system}" title="${session.operating_system}" class="w-4 h-4" />` : ""}
                  <span class="flex items-center" title="${session.device_type}">${deviceIconSVG}</span>
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 text-xs">
                    ${pageviewIconSVG}
                    <span>${session.pageviews || 0}</span>
                  </span>
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 text-xs">
                    ${eventIconSVG}
                    <span>${session.events || 0}</span>
                  </span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 text-xs">
                    ${referrerIconSVG}
                    <span>${referrerText}</span>
                  </span>
                </div>
                <div class="flex items-center justify-between gap-2 text-xs text-neutral-400 pt-1.5 border-t border-neutral-700">
                  <span>${startTime}</span>
                  <span class="text-neutral-200">${durationDisplay}</span>
                </div>
                <button
                  class="view-session-btn w-full px-2 py-1 bg-accent-600 hover:bg-accent-700 text-white text-xs font-medium rounded transition-colors"
                  data-session-id="${session.session_id}"
                  tabindex="-1"
                >
                  View Details
                </button>
              </div>
            `;

          popupRef.current.setLngLat([roundedLon, roundedLat]).setHTML(html).addTo(map.current);
          openTooltipSessionIdRef.current = session.session_id;

          // Add click handler to the button
          const button = document.querySelector(`[data-session-id="${session.session_id}"]`);
          if (button) {
            button.addEventListener("click", e => {
              e.stopPropagation();
              setSelectedSession(session);
              popupRef.current?.remove();
              openTooltipSessionIdRef.current = null;
            });
          }
        };

        avatarContainer.addEventListener("click", toggleTooltip);

        // Create cleanup function to remove event listener
        const cleanup = () => {
          avatarContainer.removeEventListener("click", toggleTooltip);
        };

        // Store marker with cleanup function
        markersMap.set(session.session_id, { marker, element: avatarContainer, cleanup });
      }
    });

    // Cleanup function
    return () => {
      // Clean up all markers and their event listeners
      markersMap.forEach(({ marker, cleanup }) => {
        cleanup(); // Remove event listeners
        marker.remove();
      });
      if (map.current) {
        map.current.off("click", handleMapClick);
      }
    };
  }, [activeSessions, mapLoaded, map, mapView]);

  return {
    selectedSession,
    setSelectedSession,
  };
}
