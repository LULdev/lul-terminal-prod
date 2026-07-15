/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { GrabState } from '../types';

interface GrabZoneProps {
  cursorGrabbed: boolean;
  gameOver: boolean;
  onCursorGrabbed: () => void;
  mousePos: { x: number; y: number };
  trapButtonRef?: React.RefObject<HTMLButtonElement | null>;
  onThreatLevel?: (level: 0 | 1 | 2) => void;
  onMetricsUpdate?: (state: GrabState, rotation: number, isExtended: boolean) => void;
}

const ASSETS = {
  head: "https://s3-us-west-2.amazonaws.com/s.cdpn.io/184729/head.svg",
  waiting: "https://s3-us-west-2.amazonaws.com/s.cdpn.io/184729/hand.svg",
  stalking: "https://s3-us-west-2.amazonaws.com/s.cdpn.io/184729/hand-waiting.svg",
  grabbing: "https://s3-us-west-2.amazonaws.com/s.cdpn.io/184729/hand.svg",
  grabbed: "https://s3-us-west-2.amazonaws.com/s.cdpn.io/184729/hand-with-cursor.svg",
  shaka: "https://s3-us-west-2.amazonaws.com/s.cdpn.io/184729/hand-surfs-up.svg",
};

const LETHAL_BUTTON_RADIUS = 260;
const STALK_BUTTON_RADIUS = 380;
const ARM_EXTEND_MS = 750;
const LETHAL_GRAB_MS = 1400;
const INNER_ZONE_GRAB_MS = 1100;
const HAND_GRAB_MS = 850;

function distanceToButton(clientX: number, clientY: number, button: DOMRect) {
  const cx = button.left + button.width / 2;
  const cy = button.top + button.height / 2;
  return Math.hypot(clientX - cx, clientY - cy);
}

export function GrabZone({
  cursorGrabbed,
  gameOver,
  onCursorGrabbed,
  mousePos,
  trapButtonRef,
  onThreatLevel,
  onMetricsUpdate,
}: GrabZoneProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const armRef = useRef<HTMLDivElement>(null);
  const innerDwellTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lethalDwellTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handDwellTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [outerHovered, setOuterHovered] = useState(false);
  const [innerHovered, setInnerHovered] = useState(false);
  const [isExtended, setExtendedArm] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [nearButton, setNearButton] = useState(false);
  const [lethalProximity, setLethalProximity] = useState(false);
  const [isArmingGrab, setIsArmingGrab] = useState(false);

  let state: GrabState = 'waiting';
  if (outerHovered || nearButton) state = 'stalking';
  if (isArmingGrab) state = 'grabbing';
  if (cursorGrabbed) state = 'grabbed';
  if (gameOver) state = 'shaka';

  const syncArmingState = () => {
    setIsArmingGrab(Boolean(innerDwellTimer.current || lethalDwellTimer.current || handDwellTimer.current));
  };

  const clearDwellTimers = () => {
    if (innerDwellTimer.current) {
      clearTimeout(innerDwellTimer.current);
      innerDwellTimer.current = null;
    }
    if (lethalDwellTimer.current) {
      clearTimeout(lethalDwellTimer.current);
      lethalDwellTimer.current = null;
    }
    if (handDwellTimer.current) {
      clearTimeout(handDwellTimer.current);
      handDwellTimer.current = null;
    }
    setIsArmingGrab(false);
  };

  const attemptGrab = () => {
    if (cursorGrabbed || gameOver) return;
    clearDwellTimers();
    onCursorGrabbed();
  };

  const scheduleGrab = (timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>, delayMs: number) => {
    if (timerRef.current) return;
    setIsArmingGrab(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setIsArmingGrab(false);
      attemptGrab();
    }, delayMs);
  };

  useEffect(() => {
    if (onMetricsUpdate) {
      onMetricsUpdate(state, rotation, isExtended);
    }
  }, [state, rotation, isExtended, onMetricsUpdate]);

  useEffect(() => {
    if (!onThreatLevel) return;
    if (cursorGrabbed || gameOver) {
      onThreatLevel(2);
      return;
    }
    if (isArmingGrab) {
      onThreatLevel(2);
    } else if (lethalProximity || innerHovered || nearButton || outerHovered) {
      onThreatLevel(1);
    } else {
      onThreatLevel(0);
    }
  }, [nearButton, outerHovered, innerHovered, lethalProximity, isArmingGrab, cursorGrabbed, gameOver, onThreatLevel]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (state === 'grabbing' || state === 'stalking') {
      timer = setTimeout(() => setExtendedArm(true), ARM_EXTEND_MS);
    } else {
      setExtendedArm(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [state]);

  useEffect(() => {
    if (!armRef.current || gameOver || cursorGrabbed) return;

    const rect = armRef.current.getBoundingClientRect();
    const anchorX = rect.left + rect.width * 0.5;
    const anchorY = rect.top + rect.height * 0.5;
    const deltaX = mousePos.x - anchorX;
    const deltaY = mousePos.y - anchorY;
    const angleRad = Math.atan2(deltaX, -deltaY);
    const angleDeg = angleRad * (180 / Math.PI);
    const clampedRotation = Math.min(Math.max(Math.round(angleDeg), -88), 88);
    setRotation(clampedRotation);
  }, [mousePos, gameOver, cursorGrabbed]);

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (cursorGrabbed || gameOver) return;

      const buttonEl = trapButtonRef?.current;
      let btnDist = Infinity;
      if (buttonEl) {
        const btnRect = buttonEl.getBoundingClientRect();
        btnDist = distanceToButton(e.clientX, e.clientY, btnRect);
        setNearButton(btnDist < STALK_BUTTON_RADIUS);
        setLethalProximity(btnDist < LETHAL_BUTTON_RADIUS);
      } else {
        setNearButton(false);
        setLethalProximity(false);
      }

      if (lethalDwellTimer.current && btnDist >= LETHAL_BUTTON_RADIUS) {
        clearTimeout(lethalDwellTimer.current);
        lethalDwellTimer.current = null;
        syncArmingState();
      } else if (btnDist < LETHAL_BUTTON_RADIUS) {
        scheduleGrab(lethalDwellTimer, LETHAL_GRAB_MS);
      }

      if (!outerRef.current) return;
      const outerRect = outerRef.current.getBoundingClientRect();
      const inOuter =
        e.clientX >= outerRect.left &&
        e.clientX <= outerRect.right &&
        e.clientY >= outerRect.top &&
        e.clientY <= outerRect.bottom;
      setOuterHovered(inOuter);

      if (!innerRef.current) return;
      const innerRect = innerRef.current.getBoundingClientRect();
      const inInner =
        e.clientX >= innerRect.left &&
        e.clientX <= innerRect.right &&
        e.clientY >= innerRect.top &&
        e.clientY <= innerRect.bottom;
      setInnerHovered(inInner);

      if (innerDwellTimer.current && !inInner) {
        clearTimeout(innerDwellTimer.current);
        innerDwellTimer.current = null;
        syncArmingState();
      } else if (inInner) {
        scheduleGrab(innerDwellTimer, INNER_ZONE_GRAB_MS);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      clearDwellTimers();
    };
  }, [cursorGrabbed, gameOver, trapButtonRef]);

  useEffect(() => {
    Object.values(ASSETS).forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  const grabberClass = `grabber grabber--${state} ${isExtended ? 'grabber--extended' : ''}`;
  const wrapperStyle = { transform: `rotate(${gameOver ? 0 : rotation}deg)` };
  const handImageSrc = ASSETS[state];

  return (
    <div className="grab-zone" ref={outerRef} id="interactive-grab-zone">
      <div className="grab-zone__danger" ref={innerRef} id="danger-trigger-box">
        <div className={grabberClass} id="cute-creature-entity">
          <div className="grabber__body" id="creature-hatch" />
          <img
            className="grabber__face"
            src={ASSETS.head}
            alt="Monster Head"
            referrerPolicy="no-referrer"
            id="creature-head"
          />
          <div className="grabber__arm-wrapper" ref={armRef} style={wrapperStyle} id="rotating-shoulder-joint">
            <div className="grabber__arm" id="scaly-arm-body">
              <img
                className="grabber__hand"
                src={handImageSrc}
                alt="Monster Hand Claw"
                referrerPolicy="no-referrer"
                onMouseEnter={() => scheduleGrab(handDwellTimer, HAND_GRAB_MS)}
                onMouseLeave={() => {
                  if (handDwellTimer.current) {
                    clearTimeout(handDwellTimer.current);
                    handDwellTimer.current = null;
                    syncArmingState();
                  }
                }}
                id="interactive-claw"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}