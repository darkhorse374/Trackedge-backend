import { firestore } from "../configs/firebase.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Request, Response, NextFunction } from 'express';
import { JournalEntry } from "../types/journal.js";

export const createJournalEntry = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const journalEntry: JournalEntry = req.body;

    // Get userRef and add journalEntryId
    const journalEntryRef = firestore.collection('users').doc(user.uid).collection('journalEntries').doc();
    journalEntry.journalEntryId = journalEntryRef.id;

    // Upload to firestore
    await journalEntryRef.create(journalEntry);

    res.status(201).json({
        success: true,
        message: 'Trade successfully created',
        journalEntryId: journalEntry.journalEntryId
    });
});

export const getSingleJournalEntry = asyncHandler(async(req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const journalEntryId = req.params.journalEntryId;

    // Add a logic to verify if the user owns this journal entry (should not be a problem on the frontend at the moment)
    const journalEntrySnapshot = await firestore.collection('users').doc(user.uid).collection('journalEntries').doc(journalEntryId).get();

    if (!journalEntrySnapshot.exists) {
        res.status(404).json({
            success: false,
            message: 'Journal entry document not found in database'
        });

        return;
    }

    res.status(200).json({
        success: true, 
        message: 'Journal entry retrieved successfully',
        data: journalEntrySnapshot.data()
    });
});

export const getAllJournalEntries = asyncHandler(async(req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    
    // Get snapshot of all journal entries
    const allJournalEntriesSnapshot = await firestore.collection('users').doc(user.uid).collection('journalEntries').get();
    
    // Check if there's any journal entries 
    if (allJournalEntriesSnapshot.empty) {
        res.status(200).json({
            success: true, 
            message: 'No journal entries found for this user',
            data: []
        });

        return;
    }

    // Map documents to their data
    const journalEntriesData = allJournalEntriesSnapshot.docs.map((journalEntrySnapshot) => journalEntrySnapshot.data());

    res.status(200).json({
        success: true,
        message: 'All journal entries retrieved successfully',
        data: journalEntriesData
    });
});

export const editJournalEntry = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const journalEntryId = req.params.journalEntryId;
    const editedFields = req.body;

    // Get journalEntryRef and check if it exists
    const journalEntryRef = firestore.collection('users').doc(user.uid).collection('journalEntries').doc(journalEntryId);

    if (!(await journalEntryRef.get()).exists) {
        res.status(404).json({
            success: false,
            message: 'Failed to edit journal entry. Document cannot be found. Please enter a valid journalEntryId'
        });

        return;
    }

    // Update the document 
    await journalEntryRef.set(editedFields, { merge: true });

    res.status(200).json({
        success: true,
        message: 'Journal entry successfully edited'
    });
});

export const deleteJournalEntry = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const journalEntryId = req.params.journalEntryId;

    // Get journalEntryRef and check if it exists
    const journalEntryRef = firestore.collection('users').doc(user.uid).collection('journalEntries').doc(journalEntryId);

    if (!(await journalEntryRef.get()).exists) {
        res.status(404).json({
            success: false,
            message: 'Failed to delete journal entry. Document cannot be found. Please enter a valid journalEntryId'
        });

        return;
    }

    // Delete the document
    await journalEntryRef.delete();

    res.status(200).json({
        success: true,
        message: 'Journal entry successfully deleted'
    });
});