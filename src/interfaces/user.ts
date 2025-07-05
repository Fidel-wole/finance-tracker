export interface User {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
}

export interface CreateUserInput {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
}