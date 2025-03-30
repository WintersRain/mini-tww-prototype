// Contents of the new js/input.js

// --- State (managed internally, but relies on external updates via setters) ---
let isDraggingSelection = false;
let selectionBoxStartX = 0;
let selectionBoxStartY = 0;
let selectionBoxCurrentX = 0;
let selectionBoxCurrentY = 0;

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
            const targetY = event.clientY - rect.top;

            console.log(`Moving ${currentSelection.length} units to:`, targetX, targetY);
            currentSelection.forEach(unit => {
                unit.moveTo(targetX, targetY); // Assumes unit object has moveTo method
            });
        }
    });

    // Prevent default context menu globally
    window.addEventListener('contextmenu', (event) => {
        event.preventDefault();
    });
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
