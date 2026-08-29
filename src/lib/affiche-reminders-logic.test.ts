import assert from "node:assert/strict";
import { afficheReminderAllowed, formatAfficheWhen, formatAfficheWhenParts } from "./affiche-reminders-logic.ts";
import {
  defaultAfficheEventAt,
  joinAfficheEventAt,
  parseAfficheEventAt,
  splitAfficheEventAt,
  encodeAfficheCaption,
  parseAfficheCaption,
  newAfficheLayout,
} from "./vitrine-affiche-logic.ts";

function run() {
  assert.equal(afficheReminderAllowed(null).reason, "no_date");
  assert.equal(afficheReminderAllowed("not-a-date").reason, "no_date");
  assert.equal(afficheReminderAllowed(new Date(1_000).toISOString(), 50_000).reason, "past");
  assert.equal(afficheReminderAllowed(new Date(90_000).toISOString(), 50_000).reason, "ok");

  const iso = defaultAfficheEventAt(Date.parse("2026-08-29T10:00:00.000Z"));
  assert.ok(iso);
  const split = splitAfficheEventAt(iso);
  assert.match(split.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(split.time, /^\d{2}:\d{2}$/);
  assert.ok(joinAfficheEventAt(split.date, split.time));
  assert.equal(parseAfficheEventAt("nope"), null);
  assert.ok(formatAfficheWhen(iso, "fr-FR"));
  const parts = formatAfficheWhenParts(iso, "fr-FR");
  assert.ok(parts?.date);
  assert.ok(parts?.time);

  const layout = newAfficheLayout();
  assert.ok(layout.eventAt);
  const parsed = parseAfficheCaption(encodeAfficheCaption(layout));
  assert.ok(parsed?.eventAt);

  console.log("affiche-reminders-logic: all checks passed");
}

run();
