import { firestore } from '../configs/firebase.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Request, Response, NextFunction } from 'express';
import { getCoreMetrics, getConsistencyMetrics, getExecutionQualityMetrics } from '../utils/metrics/setupSpecific.js';


// Create Setup 
export const createSetup = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const { ...setup } = req.body; 

    // Initialise totalPnL to 0 
    setup.totalPnL = 0;
    
    // Generate a reference for data and set it as setupId 
    const setupRef = firestore.collection('users').doc(user.uid).collection('setups').doc();
    setup.setupId = setupRef.id;

    // Upload to reference location
    await setupRef.create(setup);

    res.status(201).json({
        success: true, 
        message: 'Setup successfully created',
        setupId: setup.setupId
    });
})


// Get all user's setups 
export const getAllSetups = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    // Get all setups 
    const setupsSnapshot = await firestore.collection('users').doc(user.uid).collection('setups').get();

    // Check if there are any setups 
    if (setupsSnapshot.empty) {
        res.status(200).json({
            success: true, 
            message: 'No setups found for this user',
            data: []
        });

        return;
    }
    
    // Map documents to their data 
    const setupsData = setupsSnapshot.docs.map((setupSnapshot) => setupSnapshot.data());

    res.status(200).json({
        success: true, 
        message: 'All setups retrieved successfully',
        data: setupsData
    });
});


// Get a single setup  
export const getSingleSetup = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const setupId = req.params.setupId;

    const setupRef = firestore.collection('users').doc(user.uid).collection('setups').doc(setupId);

    const setupSnapshot = await setupRef.get();

    if (!setupSnapshot.exists) {
        res.status(404).json({
            success: false,
            message: 'Setup document not found in database'
        });

        return;
    }

    res.status(200).json({
        success: true, 
        message: 'Setup retrieved successfully',
        data: setupSnapshot.data()
    });
});


// Update Setup 
export const updateSetup = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const { newSetup } = req.body; 
    const setupId = req.params.setupId; 

    // Get setupRef
    const setupRef = firestore.collection('users').doc(user.uid).collection('setups').doc(setupId);

    // Check if document updating exists 
    const setupSnapshot = await setupRef.get();
    if (!setupSnapshot.exists) {
        res.status(404).json({
            success: false,
            message: 'Setup document not found in database'
        });

        return;
    }

    // Set the Setup document to newSetup
    await setupRef.set(newSetup);

    res.status(200).json({
        success: true, 
        message: 'Setup updated successfully'
    });
})

// Delete Setup 
export const deleteSetup = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const setupId = req.params.setupId; 

    // Get Setup reference
    const setupRef = firestore.collection('users').doc(user.uid).collection('setups').doc(setupId);

    // Check if the document exists
    const setupSnapshot = await setupRef.get();
    if (!setupSnapshot.exists) {
        res.status(404).json({
            success: false,
            message: 'Setup document not found in database'
        });

        return;
    }

    await setupRef.delete();

    res.status(200).json({
        success: true, 
        message: 'Setup deleted successfully'
    });
})

// Get Setup Metrics
export const getSetupMetrics = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user; 
    const setupId = req.params.setupId;


    // Add error checking if user does not own setup (should not be a problem if handled by frontend)

    const coreMetricsFactory = await getCoreMetrics(req, setupId);

    const coreMetrics = {
        totalTrades: coreMetricsFactory.getTotalTrades(),
        winRate: coreMetricsFactory.getWinRate(),
        avgWin: coreMetricsFactory.getAvgWin(),
        avgLoss: coreMetricsFactory.getAvgLoss(),
        avgRRR: coreMetricsFactory.getAvgRRR(),
        profitFactor: coreMetricsFactory.getProfitFactor(),
        expectancy: coreMetricsFactory.getExpectancy(),
        totalPnl: coreMetricsFactory.getTotalPnl()
    };

    const consistencyMetricsFactory = await getConsistencyMetrics(req, setupId);

    const consistencyMetrics = {
        bestStreak: consistencyMetricsFactory.getBestStreak(),
        worstStreak: consistencyMetricsFactory.getWorstStreak(),
        stdDeviation: consistencyMetricsFactory.getStdDeviation(),
        hitRate: consistencyMetricsFactory.getHitRate()
    };

    const executionQualityMetricsFactory = await getExecutionQualityMetrics(req, setupId);

    const executionQualityMetrics = {
        avgHoldTime: executionQualityMetricsFactory.getAvgHoldTime(),
        bestTimeOfDay: executionQualityMetricsFactory.getBestTimeOfDay(),
        worstTimeOfDay: executionQualityMetricsFactory.getWorstTimeOfDay()
    }


    return res.status(200).json({
        success: true,
        message: 'Successfully calculated setup metrics',
        data: {
            coreMetrics,
            consistencyMetrics,
            executionQualityMetrics
        }
    });
});