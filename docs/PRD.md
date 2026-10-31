# KeyFinder — Product Requirements

## Problem

A new home has ~20 doors (rooms + attached washrooms), each lock with 2 keys → ~40 loose keys. Every key has a stamped number, but nobody remembers which number fits which door, so people try keys one by one.

## Solution

An installable web app (PWA) on iOS and Android. A household records which key number belongs to which door once. Afterwards anyone in the household picks up a key, types or scans its number (or taps its tag), and immediately sees the door.

## Users

- **Owner** — creates the household, sets everything up, invites family.
- **Admin** — trusted family member who can also invite and manage.
- **Member** — family/staff who look up keys and can add or edit keys and doors.

## User stories (MVP)

1. As a user I log in with my email and a 6-digit code (no password).
2. As a new user I either create a home or join one with an invite code/link.
3. As an owner I add doors quickly, including "room + attached washroom" in one step.
4. As a member I add a key: number, door, optional label ("Copy 1"), holder, photo.
5. As a member I type part of a key number and see matching doors instantly.
6. As a member I point the camera at a key and the app reads the number and shows the door.
7. As a member I scan a QR sticker (or tap an NFC tag on Android) on a key ring and see the door.
8. As a member I open a door and see all its keys and who currently has them.
9. As an owner/admin I invite people via a shareable link/code and remove them.
10. As a member I can look up keys with no internet (data cached on the phone).
11. As a user I belong to more than one household and switch between them.

## Non-goals (MVP)

- Native App Store / Play Store apps (possible later via Capacitor/Expo).
- Recognising keys by the shape of their cuts.
- Smart-lock integration, key-duplication ordering.
- Offline editing (lookups work offline; edits need a connection).
- Ownership transfer, audit history, push notifications (later).

## Screens

| Screen             | Purpose                                                                        |
| ------------------ | ------------------------------------------------------------------------------ |
| Login              | Email → 6-digit code                                                           |
| Onboarding         | Create a home / Join with code                                                 |
| Home (search)      | Large search box, Scan button, recent lookups, offline indicator               |
| Scan               | Tabs: Number (OCR) · QR · NFC (Android only); result sheet                     |
| Result             | Door name, room group, floor, key photo, holder; "Not this one" → alternatives |
| Doors              | Grouped by room group / floor; quick-add                                       |
| Door detail        | Its keys; add key                                                              |
| Key detail         | Edit number, door, label, holder, photo, tag (assign/clear)                    |
| Members            | List, roles, invite (share sheet), remove, leave                               |
| Household settings | Rename, print QR tag sheet, delete household                                   |
| Account            | Sign out, install instructions, storage status                                 |

## Setup UX matters most

Initial entry of ~20 doors and ~40 keys must take minutes, not an hour:

- "Add room with washroom" creates two doors sharing a `room_group` (e.g. _Master Bedroom_ and _Master Bedroom Washroom_).
- Quick-add key loop: pick door → enter number (type or scan) → "same number, second copy" one-tap → next.

## Success criteria

- From picking up a key to seeing its door: under 5 s when typing, under 10 s when scanning.
- Works installed on a recent iPhone (Safari) and Android (Chrome), online and offline.
- A non-member can never read or change another household's data (proved by tests).
