import { firestore } from '../configs/firebase.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Request, Response, NextFunction } from 'express';

// Create Plan 
export const createPlan = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const { plan } = req.body; 
    
    // Generate a reference for data and set it as planId 
    const planRef = firestore.collection('users').doc(user.uid).collection('plans').doc();
    plan.planId = planRef.id;

    // Upload to reference location
    await planRef.create(plan);

    res.status(201).json({
        success: true, 
        message: 'Plan successfully created',
        planId: plan.planId
    });
})

// Get all user's plan 
export const getAllPlans = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user; 

    // Get all user's plans 
    const plansSnapshot = await firestore.collection('users').doc(user.uid).collection('plans').get();

    // Check if there are any plans 
    if (plansSnapshot.empty) {
        res.status(200).json({
            success: true, 
            message: 'No plans found for this user',
            data: []
        });

        return;
    }
    
    // Map documents to their data
    const plansData = plansSnapshot.docs.map((planSnapshot) => planSnapshot.data());

    res.status(200).json({
        success: true, 
        message: 'All plans retrieved successfully',
        data: plansData
    });
});

// Get a single plan  
export const getSinglePlan = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const planId = req.params.planId;

    const planRef = firestore.collection('users').doc(user.uid).collection('plans').doc(planId);

    const planSnapshot = await planRef.get();

    if (!planSnapshot.exists) {
        res.status(404).json({
            success: false,
            message: 'Plan document not found in database'
        });

        return;
    }

    res.status(200).json({
        success: true, 
        message: 'Plan retrieved successfully',
        data: planSnapshot.data()
    });
});

// Update Plan 
export const updatePlan = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const { newPlan } = req.body; 
    const planId = req.params.planId; 

    // Get planRef
    const planRef = firestore.collection('users').doc(user.uid).collection('plans').doc(planId);

    // Check if document updating exists 
    const planSnapshot = await planRef.get();
    if (!planSnapshot.exists) {
        res.status(404).json({
            success: false,
            message: 'Plan document not found in database'
        });

        return;
    }

    // Set the Plan document to newPlan
    await planRef.set(newPlan);

    res.status(200).json({
        success: true, 
        message: 'Plan updated successfully'
    });
});

// Delete Plan 
export const deletePlan = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const planId = req.params.planId; 

    // Get Plan reference
    const planRef = firestore.collection('users').doc(user.uid).collection('plans').doc(planId);

    // Check if the document exists
    const planSnapshot = await planRef.get();
    if (!planSnapshot.exists) {
        res.status(404).json({
            success: false,
            message: 'Plan document not found in database'
        });

        return;
    }

    // Delete the Plan
    await planRef.delete();

    res.status(200).json({
        success: true, 
        message: 'Plan deleted successfully'
    });
})