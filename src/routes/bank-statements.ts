import { Router } from 'express';
import { BankStatementController } from '../controllers/bank-statement';
import { upload } from '../middleware/file-upload';

const router = Router();
const bankStatementController = new BankStatementController();


router.post('/upload', upload.single('statement'), 
  bankStatementController.uploadStatement.bind(bankStatementController)
);


router.post('/debug-pdf', upload.single('statement'), 
  BankStatementController.debugPdfText
);


router.get('/:statementId/status', 
  bankStatementController.getStatementStatus.bind(bankStatementController)
);


router.get('/:statementId/analysis', 
  bankStatementController.getStatementAnalysis.bind(bankStatementController)
);


router.get('/user/:userId', 
  bankStatementController.getUserStatements.bind(bankStatementController)
);


router.delete('/:statementId', 
  bankStatementController.deleteStatement.bind(bankStatementController)
);


router.put('/transactions/:transactionId/category', 
  bankStatementController.recategorizeTransaction.bind(bankStatementController)
);



export default router;
