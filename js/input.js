// Contents of the new js/input.js

// --- State (managed internally, but relies on external updates via setters) ---
let isDraggingSelection = false;
let selectionBoxStartX = 0;
let selectionBoxStartY = 0;
let selectionBoxCurrentX = 0;
let selectionBoxCurrentY = 0;
let lastDoubleClickTime = 0;
const DOUBLE_CLICK_COOLDOWN = 300;

// Formation Drag State
let isDraggingFormation = false;
let formationStartX = 0;
let formationStartY = 0;
let formationEndX = 0;
let formationEndY = 0;
let unitsBeingMoved = []; // Store selection when right-click drag starts

// Move Command Indicator State
let moveIndicator = null; // { startX, startY, endX, endY, timestamp }

// --- Helper ---
function isUnitInSelectionBox(unit, box) {
    // More accurate check: considers unit radius (circle bounding box intersection)
    return (
        unit.x + unit.radius >= box.x && // Right edge of circle vs Left edge of box
        unit.x - unit.radius <= box.x + box.width && // Left edge of circle vs Right edge of box
        unit.y + unit.radius >= box.y && // Bottom edge of circle vs Top edge of box
        unit.y - unit.radius <= box.y + box.height // Top edge of circle vs Bottom edge of box
    );
}

// --- Event Listener Setup ---
// Needs canvas element and functions to get/set units/selectedUnits from main scope
export function setupInputListeners(canvas, getUnits, getSelectedUnits, setSelectedUnits) {

    canvas.addEventListener('mousedown', (event) => {
        if (event.button !== 0) return; // Only react to left mouse button down

        const rect = canvas.getBoundingClientRect();
        selectionBoxStartX = event.clientX - rect.left;
        selectionBoxStartY = event.clientY - rect.top;
        selectionBoxCurrentX = selectionBoxStartX;
        selectionBoxCurrentY = selectionBoxStartY;
        isDraggingSelection = true;

        // Clear selection on mousedown ONLY if Shift is not pressed
        // This prevents clearing when starting a Shift+drag or Shift+click
        if (!event.shiftKey) {
            setSelectedUnits([]); // Use setter function
        }
    });

    canvas.addEventListener('mousemove', (event) => {
        if (!isDraggingSelection) return;

        const rect = canvas.getBoundingClientRect();
        selectionBoxCurrentX = event.clientX - rect.left;
        selectionBoxCurrentY = event.clientY - rect.top;
    });

    canvas.addEventListener('mouseup', (event) => {
        if (event.button !== 0 || !isDraggingSelection) return; // Only react to left mouse button up if dragging

        const wasDragging = isDraggingSelection; // Store state before resetting
        isDraggingSelection = false; // Reset drag state immediately

        const rect = canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left; // Use final mouse up position
        const clickY = event.clientY - rect.top;
        const shiftPressed = event.shiftKey; // Check shift state on mouse up

        const dragThreshold = 5; // Minimum pixels moved to count as a drag
        const dragDistance = Math.sqrt(
            Math.pow(clickX - selectionBoxStartX, 2) +
            Math.pow(clickY - selectionBoxStartY, 2)
        );

        const currentUnits = getUnits(); // Use getter
        let currentSelection = [...getSelectedUnits()]; // Get a mutable copy

        if (wasDragging && dragDistance > dragThreshold) {
            // --- Drag Selection Logic ---
            const selectionBox = {
                x: Math.min(selectionBoxStartX, clickX),
                y: Math.min(selectionBoxStartY, clickY),
                width: Math.abs(clickX - selectionBoxStartX),
                height: Math.abs(clickY - selectionBoxStartY),
            };

            const unitsInBox = [];
            currentUnits.forEach(unit => {
                // Allow selecting any unit for testing
                if (!unit.isDead && isUnitInSelectionBox(unit, selectionBox)) {
                    unitsInBox.push(unit);
                }
            });

            if (shiftPressed) {
                // Add units in box to current selection (avoid duplicates)
                unitsInBox.forEach(unit => {
                    if (!currentSelection.includes(unit)) {
                        currentSelection.push(unit);
                    }
                });
                console.log(`Added ${unitsInBox.length} units to selection. Total: ${currentSelection.length}`);
                setSelectedUnits(currentSelection); // Update main state
            } else {
                // Replace selection with units in box (selection was already cleared on mousedown)
                console.log(`Selected ${unitsInBox.length} units with box.`);
                setSelectedUnits(unitsInBox); // Update main state
            }
        } else {
            // --- Click Selection Logic (drag distance was small) ---

            // Ignore single click if it happens right after a double-click
            if (Date.now() - lastDoubleClickTime < DOUBLE_CLICK_COOLDOWN) {
                console.log("Ignoring single click shortly after double-click.");
                return;
            }

            let unitClicked = null;
            // Find the top-most unit clicked
            for (let i = currentUnits.length - 1; i >= 0; i--) {
                const unit = currentUnits[i];
                 if (unit.isDead) continue; // Don't select dead units
                const dx = clickX - unit.x;
                const dy = clickY - unit.y;
                if (dx * dx + dy * dy < unit.radius * unit.radius) {
                    unitClicked = unit;
                    break;
                }
            }

            if (shiftPressed) {
                // Shift + Click: Toggle selection
                if (unitClicked) {
                    const index = currentSelection.indexOf(unitClicked);
                    if (index > -1) {
                        currentSelection.splice(index, 1); // Remove if already selected
                        console.log("Removed unit from selection:", unitClicked.color);
                    } else {
                        currentSelection.push(unitClicked); // Add if not selected
                        console.log("Added unit to selection:", unitClicked.color);
                    }
                    setSelectedUnits(currentSelection); // Update main state
                }
                // Don't clear selection if shift-clicking empty space
            } else {
                // Normal Click: Replace selection with clicked unit (if any)
                if (unitClicked) {
                    console.log("Selected unit:", unitClicked.color);
                    setSelectedUnits([unitClicked]); // Update main state
                } else {
                    // If clicking empty space without shift, selection was already cleared on mousedown
                    console.log("Selection cleared (clicked empty space)");
                    setSelectedUnits([]); // Explicitly clear just in case
                }
            }
        }
    });

    // --- Right-Click Handling (Replaces contextmenu) ---
    canvas.addEventListener('mousedown', (event) => {
        if (event.button === 2) { // Right mouse button down
            const currentSelection = getSelectedUnits();
            if (currentSelection.length > 0) {
                const rect = canvas.getBoundingClientRect();
                formationStartX = event.clientX - rect.left;
                formationStartY = event.clientY - rect.top;
                formationEndX = formationStartX; // Initialize end to start
                formationEndY = formationStartY;
                isDraggingFormation = true;
                unitsBeingMoved = [...currentSelection]; // Store the units being commanded
                moveIndicator = null; // Clear previous indicator
            }
        }
    });

     canvas.addEventListener('mousemove', (event) => {
        // Update selection box drag (left mouse)
        if (isDraggingSelection) {
             const rect = canvas.getBoundingClientRect();
             selectionBoxCurrentX = event.clientX - rect.left;
             selectionBoxCurrentY = event.clientY - rect.top;
        }
        // Update formation drag line (right mouse)
        if (isDraggingFormation) {
            const rect = canvas.getBoundingClientRect();
            formationEndX = event.clientX - rect.left;
            formationEndY = event.clientY - rect.top;
            // Update temporary indicator for drawing
             moveIndicator = {
                startX: formationStartX, startY: formationStartY,
                endX: formationEndX, endY: formationEndY,
                timestamp: Date.now() // Keep updating timestamp while dragging
            };
        }
    });

     canvas.addEventListener('mouseup', (event) => {
        // Handle Left Mouse Up (Selection)
        if (event.button === 0 && isDraggingSelection) {
            // ... (existing selection logic remains here) ...
            // Reset drag state immediately
            const wasDragging = isDraggingSelection;
            isDraggingSelection = false;

            const rect = canvas.getBoundingClientRect();
            const clickX = event.clientX - rect.left; // Use final mouse up position
            const clickY = event.clientY - rect.top;
            const shiftPressed = event.shiftKey; // Check shift state on mouse up

            const dragThreshold = 5; // Minimum pixels moved to count as a drag
            const dragDistance = Math.sqrt(
                Math.pow(clickX - selectionBoxStartX, 2) +
                Math.pow(clickY - selectionBoxStartY, 2)
            );

            const currentUnits = getUnits(); // Use getter
            let currentSelection = [...getSelectedUnits()]; // Get a mutable copy

            if (wasDragging && dragDistance > dragThreshold) {
                // --- Drag Selection Logic ---
                const selectionBox = {
                    x: Math.min(selectionBoxStartX, clickX),
                    y: Math.min(selectionBoxStartY, clickY),
                    width: Math.abs(clickX - selectionBoxStartX),
                    height: Math.abs(clickY - selectionBoxStartY),
                };

                const unitsInBox = [];
                currentUnits.forEach(unit => {
                    if (!unit.isDead && isUnitInSelectionBox(unit, selectionBox)) {
                        unitsInBox.push(unit);
                    }
                });

                if (shiftPressed) {
                    unitsInBox.forEach(unit => {
                        if (!currentSelection.includes(unit)) {
                            currentSelection.push(unit);
                        }
                    });
                    console.log(`Added ${unitsInBox.length} units to selection. Total: ${currentSelection.length}`);
                    setSelectedUnits(currentSelection);
                } else {
                    console.log(`Selected ${unitsInBox.length} units with box.`);
                    setSelectedUnits(unitsInBox);
                }
            } else {
                // --- Click Selection Logic ---
                if (Date.now() - lastDoubleClickTime < DOUBLE_CLICK_COOLDOWN) {
                    console.log("Ignoring single click shortly after double-click.");
                    return;
                }
                let unitClicked = null;
                for (let i = currentUnits.length - 1; i >= 0; i--) {
                    const unit = currentUnits[i];
                     if (unit.isDead) continue;
                    const dx = clickX - unit.x;
                    const dy = clickY - unit.y;
                    if (dx * dx + dy * dy < unit.radius * unit.radius) {
                        unitClicked = unit;
                        break;
                    }
                }
                if (shiftPressed) {
                    if (unitClicked) {
                        const index = currentSelection.indexOf(unitClicked);
                        if (index > -1) {
                            currentSelection.splice(index, 1);
                            console.log("Removed unit from selection:", unitClicked.color);
                        } else {
                            currentSelection.push(unitClicked);
                            console.log("Added unit to selection:", unitClicked.color);
                        }
                        setSelectedUnits(currentSelection);
                    }
                } else {
                    if (unitClicked) {
                        console.log("Selected unit:", unitClicked.color);
                        setSelectedUnits([unitClicked]);
                    } else {
                        console.log("Selection cleared (clicked empty space)");
                        setSelectedUnits([]);
                    }
                }
            }
        }

        // Handle Right Mouse Up (Formation Move Command)
        if (event.button === 2 && isDraggingFormation) {
            isDraggingFormation = false;
            const dragThreshold = 10; // Min drag distance for line formation
            const dx = formationEndX - formationStartX;
            const dy = formationEndY - formationStartY;
            const dragDist = Math.sqrt(dx * dx + dy * dy);

            const targetX = (formationStartX + formationEndX) / 2; // Midpoint of drag
            const targetY = (formationStartY + formationEndY) / 2;

            if (unitsBeingMoved.length === 0) return; // No units were selected when drag started

            if (unitsBeingMoved.length === 1 || dragDist < dragThreshold) {
                 // Single unit or simple click: Move to end point (or midpoint)
                 const finalTargetX = dragDist < dragThreshold ? formationStartX : formationEndX;
                 const finalTargetY = dragDist < dragThreshold ? formationStartY : formationEndY;
                 console.log(`Moving ${unitsBeingMoved.length} unit(s) to:`, finalTargetX, finalTargetY);
                 unitsBeingMoved[0].moveTo(finalTargetX, finalTargetY);
                 // Set indicator for single point
                 moveIndicator = {
                     startX: finalTargetX - 5, startY: finalTargetY,
                     endX: finalTargetX + 5, endY: finalTargetY,
                     timestamp: Date.now()
                 };

            } else {
                // Multi-unit drag: Line formation based on drag vector
                console.log(`Moving ${unitsBeingMoved.length} units to formation line.`);

                const spacing = 1.5; // Spacing between units
                const largeRadius = 10; // Tank radius threshold
                const rowSpacing = largeRadius * 2 + spacing * 2; // Distance between rows

                // Separate tanks and dps
                const tanks = unitsBeingMoved.filter(u => u.radius >= largeRadius);
                const dps = unitsBeingMoved.filter(u => u.radius < largeRadius);

                // Calculate formation angle based on drag direction
                const formationAngleRad = Math.atan2(dy, dx);
                const cosAngle = Math.cos(formationAngleRad);
                const sinAngle = Math.sin(formationAngleRad);

                // Calculate perpendicular vector for row offset
                const perpX = -sinAngle;
                const perpY = cosAngle;

                // --- Assign DPS to front row(s) ---
                let dpsWidth = 0;
                dps.forEach(unit => { dpsWidth += (unit.radius * 2) + spacing; });
                dpsWidth = Math.max(0, dpsWidth - spacing); // Total width of DPS line

                let currentOffset = -dpsWidth / 2;
                dps.sort((a, b) => a.x - b.x).forEach(unit => { // Sort by X for consistency
                    const unitOffset = currentOffset + unit.radius;
                    const unitTargetX = targetX + cosAngle * unitOffset;
                    const unitTargetY = targetY + sinAngle * unitOffset;
                    unit.moveTo(unitTargetX, unitTargetY);
                    currentOffset += (unit.radius * 2) + spacing;
                });

                 // --- Assign Tanks to back row(s) ---
                 let tankWidth = 0;
                 tanks.forEach(unit => { tankWidth += (unit.radius * 2) + spacing; });
                 tankWidth = Math.max(0, tankWidth - spacing); // Total width of Tank line

                 currentOffset = -tankWidth / 2;
                 // Calculate back row center point (offset behind targetY along perpendicular)
                 const backRowCenterX = targetX - perpX * rowSpacing;
                 const backRowCenterY = targetY - perpY * rowSpacing;

                 tanks.sort((a, b) => a.x - b.x).forEach(unit => { // Sort by X
                    const unitOffset = currentOffset + unit.radius;
                    // Calculate position relative to back row center point
                    const unitTargetX = backRowCenterX + cosAngle * unitOffset;
                    const unitTargetY = backRowCenterY + sinAngle * unitOffset;
                    unit.moveTo(unitTargetX, unitTargetY);
                    currentOffset += (unit.radius * 2) + spacing;
                 });

                 // Store indicator based on drag start/end for visualization
                 moveIndicator = {
                     startX: formationStartX, startY: formationStartY,
                     endX: formationEndX, endY: formationEndY,
                     timestamp: Date.now()
                 };
            }
             unitsBeingMoved = []; // Clear the temporary list
        }
    });


    // Prevent default context menu globally (keep this)
    window.addEventListener('contextmenu', (event) => {
        event.preventDefault();
    });

    // --- Double Click Listener ---
    canvas.addEventListener('dblclick', (event) => {
        if (event.button !== 0) return; // Only react to left mouse button

        const rect = canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;

        const currentUnits = getUnits();
        let unitDoubleClicked = null;

        // Find the top-most unit double-clicked
        for (let i = currentUnits.length - 1; i >= 0; i--) {
            const unit = currentUnits[i];
            if (unit.isDead) continue; // Don't select dead units
            const dx = clickX - unit.x;
            const dy = clickY - unit.y;
            if (dx * dx + dy * dy < unit.radius * unit.radius) {
                unitDoubleClicked = unit;
                break;
            }
        }

        if (unitDoubleClicked) {
            const typeRadius = unitDoubleClicked.radius;
            const typeTeam = unitDoubleClicked.team;
            const unitsToSelect = currentUnits.filter(unit =>
                !unit.isDead && unit.radius === typeRadius && unit.team === typeTeam
            );

            if (unitsToSelect.length > 0) {
                console.log(`Selected ${unitsToSelect.length} units of type (radius ${typeRadius}, team ${typeTeam})`);
                setSelectedUnits(unitsToSelect);
                lastDoubleClickTime = Date.now(); // Record time of successful double-click selection
            }
        } else {
            // Optional: Double-clicking empty space could have different behavior,
            // but for now it does nothing different than single click (clears selection via mousedown).
        }
    });
    // --- End Double Click Listener ---

}

// Export necessary state/functions for drawing the selection box and move indicator
export function getSelectionBoxState() {
    return {
        isDragging: isDraggingSelection,
        startX: selectionBoxStartX,
        startY: selectionBoxStartY,
        currentX: selectionBoxCurrentX,
        currentY: selectionBoxCurrentY,
    };
}

export function getMoveIndicator() {
    // Return indicator only if it's recent
    if (moveIndicator && Date.now() - moveIndicator.timestamp < 1000) {
        return moveIndicator;
    }
    return null;
}
