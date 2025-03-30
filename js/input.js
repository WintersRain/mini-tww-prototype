// Contents of the new js/input.js

// --- State (managed internally, but relies on external updates via setters) ---
let isDraggingSelection = false;
let selectionBoxStartX = 0;
let selectionBoxStartY = 0;
let selectionBoxCurrentX = 0;
let selectionBoxCurrentY = 0;
let lastDoubleClickTime = 0; // Timestamp of the last successful double-click selection
const DOUBLE_CLICK_COOLDOWN = 300; // Milliseconds to ignore single clicks after double-click

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

    canvas.addEventListener('contextmenu', (event) => {
        // event.preventDefault(); // Handled globally now
        const currentSelection = getSelectedUnits(); // Use getter
        if (currentSelection.length > 0) {
            const rect = canvas.getBoundingClientRect();
            const targetX = event.clientX - rect.left;
            const targetY = event.clientY - rect.top; // Center of the formation

            if (currentSelection.length === 1) {
                // Single unit selection - move directly to target
                console.log(`Moving 1 unit to:`, targetX, targetY);
                currentSelection[0].moveTo(targetX, targetY);
            } else {
                // Multiple units - calculate directional line formation points
                console.log(`Moving ${currentSelection.length} units to formation at:`, targetX, targetY);

                // --- Directional Line Formation ---
                const spacing = 1.5; // Use collision buffer + a little extra
                const largeRadius = 10; // Need radius info here, maybe pass from game.js? Hardcoding for now.

                // 1. Sort units: DPS first, then Tanks
                const sortedSelection = [...currentSelection].sort((a, b) => {
                    const aIsTank = a.radius >= largeRadius;
                    const bIsTank = b.radius >= largeRadius;
                    if (aIsTank === bIsTank) return a.x - b.x; // Sort by X within type
                    return aIsTank ? 1 : -1; // Tanks go to the end
                });
                const numUnits = sortedSelection.length;

                // 2. Calculate total width needed based on sorted units
                let totalWidth = 0;
                sortedSelection.forEach(unit => {
                    totalWidth += (unit.radius * 2) + spacing;
                });
                totalWidth -= spacing; // Remove last spacing

                // 3. Determine Formation Angle
                // Calculate average current position of selected units
                let avgX = 0;
                let avgY = 0;
                sortedSelection.forEach(unit => { avgX += unit.x; avgY += unit.y; });
                avgX /= numUnits;
                avgY /= numUnits;

                // Angle from average position to target click
                const angleRad = Math.atan2(targetY - avgY, targetX - avgX);
                // Make formation line perpendicular to movement direction
                const formationAngleRad = angleRad + Math.PI / 2;
                const cosAngle = Math.cos(formationAngleRad);
                const sinAngle = Math.sin(formationAngleRad);

                // 4. Calculate starting point for the line
                let currentOffset = -totalWidth / 2; // Start from the left end of the line width

                // 5. Assign individual targets along the rotated line
                sortedSelection.forEach(unit => {
                    const unitOffset = currentOffset + unit.radius; // Position center of unit along the line

                    // Calculate position relative to target point based on angle and offset
                    const unitTargetX = targetX + cosAngle * unitOffset;
                    const unitTargetY = targetY + sinAngle * unitOffset;

                    unit.moveTo(unitTargetX, unitTargetY);

                    // Move to the start position for the next unit
                    currentOffset += (unit.radius * 2) + spacing;
                });
                // --- End Formation Logic ---
            }
        }
    });

    // Prevent default context menu globally
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

// Export necessary state/functions for drawing the selection box
export function getSelectionBoxState() {
    return {
        isDragging: isDraggingSelection,
        startX: selectionBoxStartX,
        startY: selectionBoxStartY,
        currentX: selectionBoxCurrentX,
        currentY: selectionBoxCurrentY,
    };
}
