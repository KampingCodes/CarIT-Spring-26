/**
 * Decodes a VIN (Vehicle Identification Number) and extracts vehicle information
 * @param {string} vin - The VIN to decode (17 characters)
 * @returns {Promise<Object>} Object containing vehicle details from NHTSA API
 * @throws {Error} If VIN is invalid or API call fails
 */
async function decodeVIN(vin) {
    try {
        // Validate VIN format
        if (!vin || vin.length !== 17) {
            throw new Error('VIN must be exactly 17 characters long');
        }

        // Remove spaces and convert to uppercase
        const cleanVIN = vin.trim().toUpperCase();

        const response = await fetch(
            `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${cleanVIN}?format=json`
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Check if API returned valid results
        if (!data.Results || data.Results.length === 0) {
            throw new Error('Invalid VIN - no results from NHTSA API');
        }

        const vehicle = data.Results[0];

        // Check if decoder found the VIN
        if (vehicle.ErrorCode && vehicle.ErrorCode !== '0') {
            throw new Error(`NHTSA Error: ${vehicle.ErrorText || 'Unable to decode VIN'}`);
        }

        return vehicle;
    } catch (error) {
        console.error("Error decoding VIN:", error);
        throw error;
    }
}

/**
 * Extracts vehicle selector fields (year, make, model, trim) from VIN decode result
 * @param {Object} vinData - The vehicle data returned from decodeVIN()
 * @returns {Object} Object with { year, make, model, trim } fields
 */
function extractVehicleFields(vinData) {
    return {
        year: vinData.ModelYear || '',
        make: vinData.Make || '',
        model: vinData.Model || '',
        trim: vinData.Trim || ''
    };
}

/**
 * Auto-fills vehicle selector with VIN data
 * Decodes VIN and returns extracted vehicle information
 * @param {string} vin - The VIN to decode
 * @returns {Promise<Object>} Vehicle info ready for form fill: { year, make, model, trim }
 */
async function autoFillVehicleFromVIN(vin) {
    try {
        const vinData = await decodeVIN(vin);
        const vehicleInfo = extractVehicleFields(vinData);
        
        console.log("VIN Decode Success:", {
            year: vehicleInfo.year,
            make: vehicleInfo.make,
            model: vehicleInfo.model,
            trim: vehicleInfo.trim,
            bodyClass: vinData.BodyClass,
            fuelType: vinData.FuelTypePrimary,
            engineCylinders: vinData.EngineCylinders,
            horsepower: vinData.EngineHP
        });

        return vehicleInfo;
    } catch (error) {
        console.error("Failed to auto-fill vehicle from VIN:", error);
        throw error;
    }
}

export { decodeVIN, extractVehicleFields, autoFillVehicleFromVIN };