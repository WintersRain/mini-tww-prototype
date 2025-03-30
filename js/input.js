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

    // --- Combined Mouse Down Listener ---
    canvas.addEventListener('mousedown', (event) => {
        const rect = canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;

        if (event.button === 0) { // Left mouse button down (Selection Start)
            selectionBoxStartX = clickX;
            selectionBoxStartY = clickY;
            selectionBoxCurrentX = selectionBoxStartX;
            selectionBoxCurrentY = selectionBoxStartY;
            isDraggingSelection = true;

            if (!event.shiftKey) {
                setSelectedUnits([]);
            }
        } else if (event.button === 2) { // Right mouse button down (Formation Start)
             const currentSelection = getSelectedUnits();
            if (currentSelection.length > 0) {
                formationStartX = clickX;
                formationStartY = clickY;
                formationEndX = formationStartX;
                formationEndY = formationStartY;
                isDraggingFormation = true;
                unitsBeingMoved = [...currentSelection];
                moveIndicator = null;
            }
        }
    });

    // --- Combined Mouse Move Listener ---
     canvas.addEventListener('mousemove', (event) => {
        const rect = canvas.getBoundingClientRect();
        const currentX = event.clientX - rect.left;
        const currentY = event.clientY - rect.top;

        // Update selection box drag (left mouse)
        if (isDraggingSelection) {
             selectionBoxCurrentX = currentX;
             selectionBoxCurrentY = currentY;
        }
        // Update formation drag line (right mouse)
        if (isDraggingFormation) {
            formationEndX = currentX;
            formationEndY = currentY;
            // Update temporary indicator for drawing
             moveIndicator = {
                startX: formationStartX, startY: formationStartY,
                endX: formationEndX, endY: formationEndY,
                timestamp: Date.now() // Keep updating timestamp while dragging
            };
        }
    });

    // --- Combined Mouse Up Listener ---
     canvas.addEventListener('mouseup', (event) => {
        const rect = canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left; // Use final mouse up position
        const clickY = event.clientY - rect.top;

        // Handle Left Mouse Up (Selection)
        if (event.button === 0 && isDraggingSelection) {
            const wasDragging = isDraggingSelection; // Store state before resetting
            isDraggingSelection = false; // Reset drag state immediately

            const shiftPressed = event.shiftKey; // Check shift state on mouse up
            const dragThreshold = 5;
            const dragDistance = Math.sqrt(
                Math.pow(clickX - selectionBoxStartX, 2) +
                Math.pow(clickY - selectionBoxStartY, 2)
            );

            const currentUnits = getUnits();
            let currentSelection = [...getSelectedUnits()];

            if (wasDragging && dragDistance > dragThreshold) {
                // Drag Selection Logic
                const selectionBox = {
                    x: Math.min(selectionBoxStartX, clickX),
                    y: Math.min(selectionBoxStartY, clickY),
                    width: Math.abs(clickX - selectionBoxStartX),
                    height: Math.abs(clickY - selectionBoxStartY),
                };
                const unitsInBox = currentUnits.filter(unit =>
                    !unit.isDead && isUnitInSelectionBox(unit, selectionBox)
                );

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
                // Click Selection Logic
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
            const dragThreshold = 10;
            const dx = formationEndX - formationStartX;
            const dy = formationEndY - formationStartY;
            const dragDist = Math.sqrt(dx * dx + dy * dy);

            const formationCenterX = (formationStartX + formationEndX) / 2;
            const formationCenterY = (formationStartY + formationEndY) / 2;

            if (unitsBeingMoved.length === 0) return;

            if (unitsBeingMoved.length === 1 || dragDist < dragThreshold) {
                 // Single unit or simple click: Move to end point
                 const finalTargetX = formationEndX;
                 const finalTargetY = formationEndY;
                 console.log(`Moving ${unitsBeingMoved.length} unit(s) to:`, finalTargetX, finalTargetY);
                 unitsBeingMoved[0].moveTo(finalTargetX, finalTargetY);
                 moveIndicator = {
                     startX: finalTargetX - 5, startY: finalTargetY,
                     endX: finalTargetX + 5, endY: finalTargetY,
                     timestamp: Date.now()
                 };
            } else {
                // Multi-unit drag: Multi-Row Line formation based on drag vector
                console.log(`Moving ${unitsBeingMoved.length} units to multi-row formation.`);

                const spacing = 3.0; // Spacing between units
                const rowSpacing = 15; // Distance between front (DPS) and back (Tank) rows

                // Separate tanks and dps based on role property
                const tanks = unitsBeingMoved.filter(u => u.role === 'tank');
                const dps = unitsBeingMoved.filter(u => u.role === 'dps'); // Assuming other roles are dps for now

                // Calculate formation angle based on drag direction (start to end)
                const formationAngleRad = Math.atan2(dy, dx);
                const cosAngle = Math.cos(formationAngleRad);
                const sinAngle = Math.sin(formationAngleRad);

                // Calculate perpendicular vector for row offset ("forward" is drag direction)
                const forwardX = cosAngle;
                const forwardY = sinAngle;
                const perpX = -forwardY; // Perpendicular points "left" relative to forward
                const perpY = forwardX;

                // --- Assign DPS to Front Row(s) ---
                if (dps.length > 0) {
                    let dpsWidth = 0;
                    dps.forEach(unit => { dpsWidth += (unit.radius * 2) + spacing; });
                    dpsWidth = Math.max(0, dpsWidth - spacing);

                    let currentOffset = -dpsWidth / 2;
                    // Sort DPS units based on their projection onto the perpendicular axis
                    dps.sort((a, b) => (a.x * perpX + a.y * perpY) - (b.x * perpX + b.y * perpY));

                    dps.forEach(unit => {
                        const unitOffset = currentOffset + unit.radius;
                        // Calculate position along the formation line (centered at formationCenterX/Y)
                        const unitTargetX = formationCenterX + perpX * unitOffset;
                        const unitTargetY = formationCenterY + perpY * unitOffset;
                        unit.moveTo(unitTargetX, unitTargetY);
                        currentOffset += (unit.radius * 2) + spacing;
                    });
                }

                 // --- Assign Tanks to Back Row(s) ---
                 if (tanks.length > 0) {
                    let tankWidth = 0;
                    tanks.forEach(unit => { tankWidth += (unit.radius * 2) + spacing; });
                    tankWidth = Math.max(0, tankWidth - spacing);

                    let currentOffset = -tankWidth / 2;
                    // Calculate back row center point (offset behind front line center)
                    const backRowCenterX = formationCenterX - forwardX * rowSpacing;
                    const backRowCenterY = formationCenterY - forwardY * rowSpacing;

                    // Sort Tanks based on their projection onto the perpendicular axis
                    tanks.sort((a, b) => (a.x * perpX + a.y * perpY) - (b.x * perpX + b.y * perpY));

                    tanks.forEach(unit => {
                        const unitOffset = currentOffset + unit.radius;
                        // Calculate position relative to back row center point along the perpendicular
                        const unitTargetX = backRowCenterX + perpX * unitOffset;
                        const unitTargetY = backRowCenterY + perpY * unitOffset;
                        unit.moveTo(unitTargetX, unitTargetY);
                        currentOffset += (unit.radius * 2) + spacing;
                    });
                 }

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
            // Use ROLE for type matching now
            const typeRole = unitDoubleClicked.role;
            const typeTeam = unitDoubleClicked.team;
            const unitsToSelect = currentUnits.filter(unit =>
                !unit.isDead && unit.role === typeRole && unit.team === typeTeam
            );

            if (unitsToSelect.length > 0) {
                console.log(`Selected ${unitsToSelect.length} units of type (${typeRole}, team ${typeTeam})`);
                setSelectedUnits(unitsToSelect);
                lastDoubleClickTime = Date.now(); // Record time of successful double-click selection
            }
        } else {
            // Optional: Double-clicking empty space could have different behavior
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
