'use strict';

// External Modules
import { r as RethinkDB } from 'rethinkdb-ts';

// Types
import { RDatum } from 'rethinkdb-ts';
import { Permission, PermissionTargetEntity, UserRoles } from 'src/Modules';
import { PermissionParameterEvaluation } from './';

// Constants
const NEGATED = true;
const NOT_NEGATED = false;
const NOT_DELETED = false;

export function generateUserAuthorisedBySubjectQuery <GenericPermissionType extends string, GenericTargetEntityType extends string, GenericTargetEntity extends PermissionTargetEntity <any>>
({domainId, userRoles, permission, subject}: {domainId: string, userRoles: RDatum <UserRoles <GenericTargetEntityType>>, permission: GenericPermissionType, subject: GenericTargetEntity})
{
	const query: RDatum <PermissionParameterEvaluation> = RethinkDB
		.expr
		(
			{
				granted: userRoles
					.concatMap
					(
						role => RethinkDB
							.table<Permission <any>>(this.table)
							.getAll
							(
								[ domainId, permission, NOT_NEGATED, role('id'), role('type'), subject.id, subject.type, NOT_DELETED ],
								{ index: this.indexes.subject }
							)
					)
					.count()
					.gt(0),
				negated: userRoles
					.concatMap
					(
						role => RethinkDB
							.table<Permission <any>>(this.table)
							.getAll
							(
								[ domainId, permission, NEGATED, role('id'), role('type'), subject.id, subject.type, NOT_DELETED ],
								{ index: this.indexes.subject }
							)
					)
					.count()
					.eq(0)
			}
		)
		.merge
		(
			(evaluations: RDatum<PermissionParameterEvaluation>) =>
			(
				{
					authorised: RethinkDB.and
					(
						evaluations('granted').eq(true),
						evaluations('negated').eq(false)
					)
				}
			)
		);
	return query;
};