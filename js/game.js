// Contents of the new js/game.js (Main Module)

import { Unit } from './unit.js';
import { logToFeed, damageFeedEl, killFeedEl } from './feed.js';
import { handleCollisions } from './collision.js';
import { handleCombat } from './combat.js';
import { setupInputListeners, getSelectionBoxState, getMoveIndicator } from './input.js'; // Added getMoveIndicator

// --- Global State ---
const canvas = document.getElementById('gameCanvas');
if (!canvas) throw new Error("Canvas element not found!");
const ctx = canvas.getContext('2d');

let units = [];
let selectedUnits = [];

// --- State Accessors/Mutators for Input Module ---
const getUnits = () => units;
const getSelectedUnits = () => selectedUnits;
const setSelectedUnits = (newSelection) => { selectedUnits = newSelection; };

// --- Game Setup ---
function setup() {
    // Clear existing units if setup is called again
    units = [];
    selectedUnits = [];

    const playerStartX = 50; // Adjusted for smaller units
    const playerStartY = 50; // Adjusted for smaller units
    const enemyStartX = canvas.width - 250; // Further adjusted for unit count/spacing
    const enemyStartY = canvas.height - 150; // Adjusted for smaller units + more units
    const spacing = 25;     // Reduced spacing
    const smallRadius = 6;  // Halved
    const largeRadius = 10; // Halved
    const numLarge = 6;
    const numSmall = 16;
    const unitsPerRow = 8; // Controls wrapping for small units

    // --- Player Units (Blue) ---
    // Place Large Units (e.g., 2 rows of 3)
    for (let i = 0; i < numLarge; i++) {
        const row = Math.floor(i / 3);
        const col = i % 3;
        units.push(new Unit(
            playerStartX + col * spacing * 1.5, // Wider spacing for tanks
            playerStartY + row * spacing * 1.5,
            largeRadius, 'blue', 800, 100, 30, 10, 15, 'tank' // Pass role
        ));
    }
    // Place Small Units (e.g., 2 rows of 8, offset below tanks)
    const smallStartY = playerStartY + 2 * spacing * 1.5;
    for (let i = 0; i < numSmall; i++) {
        const row = Math.floor(i / unitsPerRow);
        const col = i % unitsPerRow;
        units.push(new Unit(
            playerStartX + col * spacing,
            smallStartY + row * spacing,
            smallRadius, 'blue', 320, 70, 50, 20, 5, 'dps' // Pass role
        ));
    }

    // --- Enemy Units (Red) ---
     // Place Large Units
     for (let i = 0; i < numLarge; i++) {
        const row = Math.floor(i / 3);
        const col = i % 3;
        units.push(new Unit(
            enemyStartX + col * spacing * 1.5,
            enemyStartY + row * spacing * 1.5,
            largeRadius, 'red', 800, 100, 30, 10, 15, 'tank' // Pass role
        ));
    }
    // Place Small Units
    const enemySmallStartY = enemyStartY + 2 * spacing * 1.5;
     for (let i = 0; i < numSmall; i++) {
        const row = Math.floor(i / unitsPerRow);
        const col = i % unitsPerRow;
        units.push(new Unit(
            enemyStartX + col * spacing,
            enemySmallStartY + row * spacing,
            smallRadius, 'red', 320, 70, 50, 20, 5, 'dps' // Pass role
        ));
    }

    // Setup input listeners, passing the canvas and state accessors
    setupInputListeners(canvas, getUnits, getSelectedUnits, setSelectedUnits);
}

// --- Drawing ---
function drawGame() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw units
    units.forEach(unit => unit.draw(ctx, selectedUnits)); // Pass dependencies

    // Draw selection box
    const selectionBoxState = getSelectionBoxState();
    if (selectionBoxState.isDragging) {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
        ctx.lineWidth = 1;
        const boxWidth = selectionBoxState.currentX - selectionBoxState.startX;
        const boxHeight = selectionBoxState.currentY - selectionBoxState.startY;
        ctx.fillRect(selectionBoxState.startX, selectionBoxState.startY, boxWidth, boxHeight);
        ctx.strokeRect(selectionBoxState.startX, selectionBoxState.startY, boxWidth, boxHeight);
    }

    // Draw move command indicator
    const indicator = getMoveIndicator(); // Get indicator state from input module
    if (indicator) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'; // White, semi-transparent
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(indicator.startX, indicator.startY);
        ctx.lineTo(indicator.endX, indicator.endY);
        ctx.stroke();
        // Optional: Draw arrow head? More complex.
    }
}

// --- Game Loop ---
let lastTime = 0;
const MAX_DELTA_TIME = 1 / 30;

function gameLoop(timestamp) {
    let deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    if (deltaTime > MAX_DELTA_TIME) {
        deltaTime = MAX_DELTA_TIME;
    }

    // 1. Update game state (Unit positions, cooldowns, etc.)
    // Pass units array needed for checkAndStopRouting
    units.forEach(unit => unit.update(deltaTime, canvas, units));

    // 2. Handle Collisions (Run twice to help units settle)
    // TODO: Performance - If slowdown occurs with many units, consider reverting to single call.
    handleCollisions(units); // Pass dependencies
    handleCollisions(units); // Second pass

    // 3. Handle Combat
    handleCombat(units, logToFeed, damageFeedEl); // Pass dependencies

    // 4. Log Kills, Apply Morale Shock, and Prepare for Removal
    const newlyDeadUnits = [];
    units.forEach(unit => {
        // isDead is set within takeDamage
        if (unit.isDead && !unit.loggedKill) {
            logToFeed(killFeedEl, `${unit.color} (${unit.team}) was defeated!`);
            unit.loggedKill = true; // Mark kill as logged
            newlyDeadUnits.push(unit); // Add to list for morale shock processing
        }
    });

    // Apply AoE Morale Shock for newly dead units
    if (newlyDeadUnits.length > 0) {
        const moraleShockRadius = 75;
        const moralePenalty = 15; // Amount of morale damage

        newlyDeadUnits.forEach(deadUnit => {
            units.forEach(otherUnit => {
                // Don't apply shock to self (already dead) or units already dead/broken
                if (otherUnit === deadUnit || otherUnit.isDead || otherUnit.isBroken) return;

                const dx = otherUnit.x - deadUnit.x;
                const dy = otherUnit.y - deadUnit.y;
                const distanceSq = dx * dx + dy * dy;

                if (distanceSq < moraleShockRadius * moraleShockRadius) {
                    // Apply morale penalty
                    otherUnit.currentMorale -= moralePenalty;
                    if (otherUnit.currentMorale < 0) otherUnit.currentMorale = 0;
                    // Optional: Log morale shock event
                    // logToFeed(damageFeedEl, `Morale Shock! ${otherUnit.color} lost ${moralePenalty} morale.`);
                    console.log(`Morale Shock! ${otherUnit.color} lost ${moralePenalty} morale.`); // Use console for now
                }
            });
        });
    }


    // 5. Remove dead units & update selection
    units = units.filter(unit => !unit.isDead);
    // Update selectedUnits by filtering based on the main units array
    setSelectedUnits(selectedUnits.filter(selected => units.includes(selected)));


    // 6. Draw everything
    drawGame();

    // Request next frame
    requestAnimationFrame(gameLoop);
}

// --- Start Game ---
setup();
requestAnimationFrame(gameLoop); // Start the loop
