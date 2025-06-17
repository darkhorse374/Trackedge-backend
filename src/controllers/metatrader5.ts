import { metaApi } from "../configs/metaApi.js";
import { firestore } from "../configs/firebase.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Request, Response, NextFunction } from 'express';
import { MT5Account } from "../types/interfaces.js";
import { MetatraderDeal } from "../types/metatrader.js";
import { JournalEntry } from "../types/journal.js";
import { calculateHoldingTime } from "../utils/calculators.js";

// =========================================================
// =================== CREATE MT5 ACCOUNT ==================
// =========================================================

export const createMT5Account = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;  
  const { accountNumber, investorPassword, brokerServer } = req.body;
  
  // Ensuring we have all accountNumber, investorPassword, and brokerServer 
  if (!accountNumber || !investorPassword || !brokerServer) {
    res.status(400).json({
      success: false,
      message: 'Missing required fields: account number, investor password, and broker server are required'
    });

    return;
  }

  // Check if this account exists within the user
  const userRef = firestore.collection('users').doc(user.uid);
  const userData = (await userRef.get()).data();
  
  const MT5Accounts: MT5Account[] = userData!.metaApi.MT5Accounts;
  if (MT5Accounts.length !== 0 && MT5Accounts.find((account) => account.accountNumber === accountNumber)) {
    res.status(400).json({
      success: false,
      message: 'MT5 account already exists'
    });

    return;
  }
  
  // Create a new account in MetaAPI 
  const account = await metaApi.metatraderAccountApi.createAccount({
    name: `${user.uid}-${accountNumber}`,
    type: 'cloud',
    login: accountNumber.toString(),
    platform: 'mt5',
    password: investorPassword,
    server: brokerServer,
    magic: 0,
    keywords: [`user:${user.uid}`],
    quoteStreamingIntervalInSeconds: 2.5,
    reliability: 'regular'
  })

  // Deploy account to API server
  await account.deploy();
  await account.waitConnected();

  // Save to database
  const MT5Account: MT5Account = {
    accountNumber,
    brokerServer,
    investorPassword,
    metaApiAccountId: account.id,
    status: 'DEPLOYED'
  };

  MT5Accounts.push(MT5Account);

  userRef.set({ metaApi: { MT5Accounts } }, { merge: true });

  // Run an initial sync
  initialMT5Sync(req, account);

  // Return to user
  res.status(201).json({
    success: true, 
    message: 'Integrated MT5 account successfully',
    data: { metaApiAccountId: account.id }
  }); 
});

// =========================================================
// =================== INITIAL MT5 SYNC ====================
// =========================================================

export const initialMT5Sync = async (req: Request, account: any) => {
  const user = req.user;

  // Initialise RPC connection 
  const connection = account.getRPCConnection();
  await connection.connect();
  await connection.waitSynchronized();

  const allDeals = await connection.getDealsByTimeRange(new Date(0), new Date());    // From epoch to current date

  // Trade history processing (convert MetatraderDeal => Trade)
  const tradeHistory = processDealHistory(allDeals.deals);

  // Upload all Trade to user's firetore 
  uploadAllMT5JournalEntries(user.uid, tradeHistory);
};

// ===================================================================
// <== Helper function to process all MT5 deals into journal entry ==>
// ===================================================================

export const processDealHistory = (deals: MetatraderDeal[]) => {
  // Group deals by position id 
  const positions: Record<string, MetatraderDeal[]> = { };
  deals.forEach((deal) => {
    if (deal.type === 'DEAL_TYPE_BALANCE') return; // Exclude balance deal types 

    if (!deal.positionId) return; // exclude if the deal for whatever reason don't have position id

    if (!positions[deal.positionId]) {
      positions[deal.positionId] = [];
    }

    positions[deal.positionId].push(deal);
  })

  // Create complete journal entries from entry/exit pairs
  const completeJournalEntries: JournalEntry[] = [];

  Object.entries(positions).forEach(([positionId, positionDeals]) => {
    // Find entry and exit deals
    const entryDeal = positionDeals.find((deal) => deal.entryType === 'DEAL_ENTRY_IN');
    const exitDeal = positionDeals.find((deal) => deal.entryType === 'DEAL_ENTRY_OUT');

    // Only process if we have both 
    if (entryDeal && exitDeal) {
      const journalEntry: JournalEntry = {
        trade: {
          // Basic details
          symbol: entryDeal.symbol!,
          type: entryDeal.type === 'DEAL_TYPE_BUY' ? 'long' : 'short',
          volume: entryDeal.volume!,

          // Entry details
          entryDate: entryDeal.time,
          entryPrice: entryDeal.price!,

          // Exit details
          exitDate: exitDeal.time,
          exitPrice: exitDeal.price!,

          // Other details
          stopLoss: exitDeal.stopLoss || entryDeal.stopLoss || 0,
          takeProfit: exitDeal.takeProfit || entryDeal.takeProfit || 0
        },

        executionQuality: {
          entryQuality: 1,
          exitQuality: 1,
          grade: 'F'
        },

        marketContext: {
          marketSession: 'new york'           // Need a helper function for these
        },

        results: {
          pnl: exitDeal.profit,
          holdTime: calculateHoldingTime(entryDeal.time, exitDeal.time)
        },

        learning: {

        }
      };

      completeJournalEntries.push(journalEntry);
    }
  });

  return completeJournalEntries;
}

// Helper function to upload all trades into firestore
export const uploadAllMT5JournalEntries = async (userId: string, journalEntries: JournalEntry[]) => {
    journalEntries.forEach(async (journalEntry) => {
    // Create a journalEntryRef and set it as journalEntryId (to stay consistent)
    const journalEntryRef = firestore.collection('users').doc(userId).collection('journalEntries').doc();
    journalEntry.journalEntryId = journalEntryRef.id; 

    // Upload to reference location 
    await journalEntryRef.create(journalEntry);
  });
};